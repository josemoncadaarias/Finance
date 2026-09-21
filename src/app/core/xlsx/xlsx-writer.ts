/**
 * A spreadsheet file, written by hand.
 *
 * Just enough of Office Open XML for one styled sheet: text, numbers, formulas
 * carrying the value they already work out to, merged cells, column widths, a
 * frozen header, and a protected sheet whose unlocked cells are the ones meant
 * to be typed into.
 *
 * No library. The ones that can write styles weigh close to a megabyte, and
 * this app ships to a phone; the format itself is a zip of a few XML files, and
 * the part of it needed here fits on a few screens. Everything is stored, not
 * compressed: a sheet of a few hundred cells is small either way, and storing
 * needs nothing beyond a CRC.
 *
 * Formulas are written with their result as well, so the file shows the right
 * figures in any viewer - including the ones that never recalculate - while
 * Excel recalculates on open and whenever an unlocked cell changes.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface CellStyle {
  font?: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number; color?: string };
  /** A solid background, as RRGGBB. */
  fill?: string;
  /** A thin grey border on all four sides. */
  border?: boolean;
  numberFormat?: string;
  align?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'top' | 'center'; indent?: number; wrap?: boolean };
  /**
   * Every cell is locked, as in Excel. Locking only takes effect on a
   * protected sheet, where it is what separates a box to type into from one
   * that works itself out.
   */
  unlocked?: boolean;
}

export type CellContent =
  | { text: string }
  | { number: number }
  | { formula: string; cached: number | string };

export interface SheetCell {
  /** 1-based, as a spreadsheet counts rows. */
  row: number;
  /** 0-based: column A is 0. */
  col: number;
  style: string;
  content?: CellContent;
}

/**
 * A chart drawn on a sheet, reading cells that are already on it.
 *
 * It points at ranges rather than carrying its own copy of the numbers, so
 * the chart is live: change a figure in the sheet and the chart follows, and
 * there is only ever one version of each number in the file.
 *
 * Two kinds, which is what this report needs and no more. A chart is the one
 * part of the format where a mistake makes Excel call the whole file corrupt,
 * so the surface is kept small enough to be read in one sitting.
 */
export interface ChartSpec {
  kind: 'bar' | 'doughnut';
  title: string;
  /** Where the labels are, as a range on this sheet: `{ from, to }` in cells. */
  categories: { fromRow: number; toRow: number; col: number };
  /** One series per column of figures, each with the heading it goes by. */
  series: { name: string; col: number }[];
  /** The box it sits in, in cells: column and row, both zero-based. */
  at: { col: number; row: number; width: number; height: number };
}

export interface SheetSpec {
  name: string;
  /** Widths in characters, from column A. */
  columnWidths: readonly number[];
  cells: SheetCell[];
  rowHeights?: Record<number, number>;
  /** Ranges such as "A1:E1". */
  merges?: string[];
  /** Rows kept in view while scrolling. */
  frozenRows?: number;
  protect?: boolean;
  /** Charts drawn over it, reading its own cells. */
  charts?: ChartSpec[];
}

export function columnName(col: number): string {
  let n = col + 1;
  let name = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function cellRef(row: number, col: number): string {
  return `${columnName(col)}${row}`;
}

/**
 * The finished file, from one sheet or several.
 *
 * Several because a report is two questions - what the period added up to,
 * and every movement behind it - and one sheet holding both is a sheet nobody
 * can sort. The styles are shared across all of them: one palette, and a name
 * used on two sheets means the same thing on both.
 */
export function writeXlsx(
  sheets: SheetSpec | readonly SheetSpec[],
  styles: Record<string, CellStyle>,
): Uint8Array<ArrayBuffer> {
  const all = Array.isArray(sheets) ? sheets : [sheets as SheetSpec];
  if (all.length === 0) throw new Error('A workbook needs at least one sheet');

  const styleIndex = new Map<string, number>();
  const stylesPart = stylesXml(styles, styleIndex);

  const encoder = new TextEncoder();
  return zip([
    ['[Content_Types].xml', contentTypes(all.length, drawnSheets(all))],
    ['_rels/.rels', ROOT_RELS],
    ['xl/workbook.xml', workbookXml(all.map(sheet => sheet.name))],
    ['xl/_rels/workbook.xml.rels', workbookRels(all.length)],
    ['xl/styles.xml', stylesPart],
    ...all.map((sheet, at): [string, string] =>
      [`xl/worksheets/sheet${at + 1}.xml`, sheetXml(sheet, styleIndex)]),
    ...chartParts(all),
  ].map(([name, text]) => ({ name, data: encoder.encode(text) })));
}

// ---------------------------------------------------------------------------
// The parts
// ---------------------------------------------------------------------------

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Every part of the file has to be declared here, each sheet included. */
function contentTypes(sheets: number, drawn: readonly { sheet: number; charts: number[] }[] = []): string {
  return HEADER
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + range(sheets).map(at =>
      `<Override PartName="/xl/worksheets/sheet${at + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + drawn.map(one =>
      `<Override PartName="/xl/drawings/drawing${one.sheet}.xml"`
      + ' ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
      + one.charts.map(at =>
        `<Override PartName="/xl/charts/chart${at}.xml"`
        + ' ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>').join(''),
    ).join('')
    + '</Types>';
}

function range(count: number): number[] {
  return Array.from({ length: count }, (_, at) => at);
}

const ROOT_RELS = HEADER
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + `<Relationship Id="rId1" Type="${RELS}/officeDocument" Target="xl/workbook.xml"/>`
  + '</Relationships>';

/** The sheets take rId1 upwards, and the styles the one after them. */
function workbookRels(sheets: number): string {
  return HEADER
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + range(sheets).map(at =>
      `<Relationship Id="rId${at + 1}" Type="${RELS}/worksheet" Target="worksheets/sheet${at + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${sheets + 1}" Type="${RELS}/styles" Target="styles.xml"/>`
    + '</Relationships>';
}

function workbookXml(names: readonly string[]): string {
  const taken = new Set<string>();

  const sheets = names.map((name, at) => {
    // Excel refuses a sheet name longer than 31 characters or holding any of
    // these, and refuses to open the file at all if two sheets share a name.
    let safe = name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || `Sheet${at + 1}`;
    for (let n = 2; taken.has(safe.toLowerCase()); n++) safe = `${safe.slice(0, 28)} ${n}`;
    taken.add(safe.toLowerCase());

    return `<sheet name="${escape(safe)}" sheetId="${at + 1}" r:id="rId${at + 1}"/>`;
  });

  return HEADER
    + `<workbook xmlns="${MAIN}" xmlns:r="${RELS}">`
    + '<bookViews><workbookView/></bookViews>'
    + `<sheets>${sheets.join('')}</sheets>`
    // Recalculated on open, so what Excel shows is always its own arithmetic.
    + '<calcPr calcId="191029" fullCalcOnLoad="1"/>'
    + '</workbook>';
}

function stylesXml(styles: Record<string, CellStyle>, index: Map<string, number>): string {
  const fonts = ['<font><sz val="10"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border>' + ['left', 'right', 'top', 'bottom'].map(side =>
      `<${side} style="thin"><color rgb="FFBFBFBF"/></${side}>`).join('') + '<diagonal/></border>',
  ];
  const formats: string[] = [];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];

  const indexOf = (list: string[], xml: string) => {
    const at = list.indexOf(xml);
    if (at >= 0) return at;
    list.push(xml);
    return list.length - 1;
  };

  for (const [name, style] of Object.entries(styles)) {
    const font = style.font ?? {};
    const fontId = indexOf(fonts, '<font>'
      + (font.bold ? '<b/>' : '') + (font.italic ? '<i/>' : '') + (font.underline ? '<u/>' : '')
      + `<sz val="${font.size ?? 10}"/><color rgb="FF${font.color ?? '000000'}"/>`
      + '<name val="Arial"/><family val="2"/></font>');

    const fillId = style.fill
      ? indexOf(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`)
      : 0;
    const borderId = style.border ? 1 : 0;
    const numFmtId = style.numberFormat ? 164 + indexOf(formats, style.numberFormat) : 0;

    const align = style.align;
    const alignment = align
      ? '<alignment'
        + (align.horizontal ? ` horizontal="${align.horizontal}"` : '')
        + (align.vertical ? ` vertical="${align.vertical}"` : '')
        + (align.indent ? ` indent="${align.indent}"` : '')
        + (align.wrap ? ' wrapText="1"' : '')
        + '/>'
      : '';
    const protection = style.unlocked ? '<protection locked="0"/>' : '';

    xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"`
      + ' applyFont="1"'
      + (fillId ? ' applyFill="1"' : '') + (borderId ? ' applyBorder="1"' : '')
      + (numFmtId ? ' applyNumberFormat="1"' : '') + (alignment ? ' applyAlignment="1"' : '')
      + (protection ? ' applyProtection="1"' : '')
      + (alignment || protection ? `>${alignment}${protection}</xf>` : '/>'));
    index.set(name, xfs.length - 1);
  }

  return HEADER
    + `<styleSheet xmlns="${MAIN}">`
    + (formats.length
      ? `<numFmts count="${formats.length}">`
        + formats.map((code, at) => `<numFmt numFmtId="${164 + at}" formatCode="${escape(code)}"/>`).join('')
        + '</numFmts>'
      : '')
    + `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`
    + `<fills count="${fills.length}">${fills.join('')}</fills>`
    + `<borders count="${borders.length}">${borders.join('')}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
}

function sheetXml(sheet: SheetSpec, styleIndex: Map<string, number>): string {
  const rows = new Map<number, SheetCell[]>();
  let lastRow = 1;
  let lastCol = 0;
  for (const cell of sheet.cells) {
    if (!styleIndex.has(cell.style)) throw new Error(`Unknown cell style: ${cell.style}`);
    const list = rows.get(cell.row) ?? [];
    list.push(cell);
    rows.set(cell.row, list);
    lastRow = Math.max(lastRow, cell.row);
    lastCol = Math.max(lastCol, cell.col);
  }
  for (const row of Object.keys(sheet.rowHeights ?? {})) {
    const at = Number(row);
    if (!rows.has(at)) rows.set(at, []);
    lastRow = Math.max(lastRow, at);
  }

  const data = [...rows.keys()].sort((a, b) => a - b).map(row => {
    const height = sheet.rowHeights?.[row];
    const cells = rows.get(row)!.sort((a, b) => a.col - b.col).map(cell => cellXml(cell, styleIndex.get(cell.style)!));
    return `<row r="${row}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells.join('')}</row>`;
  }).join('');

  const frozen = sheet.frozenRows
    ? `<pane ySplit="${sheet.frozenRows}" topLeftCell="A${sheet.frozenRows + 1}" activePane="bottomLeft" state="frozen"/>`
      + `<selection pane="bottomLeft" activeCell="B${sheet.frozenRows + 1}" sqref="B${sheet.frozenRows + 1}"/>`
    : '';

  return HEADER
    + `<worksheet xmlns="${MAIN}" xmlns:r="${RELS}">`
    + `<dimension ref="A1:${cellRef(lastRow, lastCol)}"/>`
    + `<sheetViews><sheetView showGridLines="0" workbookViewId="0">${frozen}</sheetView></sheetViews>`
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + '<cols>' + sheet.columnWidths.map((width, at) =>
      `<col min="${at + 1}" max="${at + 1}" width="${width}" customWidth="1"/>`).join('') + '</cols>'
    + `<sheetData>${data}</sheetData>`
    // Columns and rows can still be resized: protection is there to keep a
    // formula from being typed over by accident, not to get in the way.
    + (sheet.protect ? '<sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0"/>' : '')
    + (sheet.merges?.length
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
      : '')
    + '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
    // The drawing comes after the margins and before the end. A worksheet's
    // elements have a fixed order in the schema, and Excel does not read one
    // that is out of it - it reports the whole file as corrupt.
    + (sheet.charts?.length ? '<drawing r:id="rId1"/>' : '')
    + '</worksheet>';
}

function cellXml(cell: SheetCell, style: number): string {
  const ref = cellRef(cell.row, cell.col);
  const content = cell.content;
  if (!content) return `<c r="${ref}" s="${style}"/>`;

  if ('text' in content) {
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escape(content.text)}</t></is></c>`;
  }
  if ('number' in content) {
    return `<c r="${ref}" s="${style}"><v>${number(content.number, ref)}</v></c>`;
  }
  if (typeof content.cached === 'string') {
    return `<c r="${ref}" s="${style}" t="str"><f>${escape(content.formula)}</f><v>${escape(content.cached)}</v></c>`;
  }
  return `<c r="${ref}" s="${style}"><f>${escape(content.formula)}</f><v>${number(content.cached, ref)}</v></c>`;
}

function number(value: number, ref: string): string {
  if (!Number.isFinite(value)) throw new Error(`Cell ${ref} holds ${value}, which a spreadsheet cannot store`);
  return String(value);
}

function escape(text: string): string {
  return text
    // Control characters are not allowed in XML at all.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// The zip around them
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** A zip with every entry stored as it is, which every spreadsheet reader accepts. */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  // 1980-01-01, the earliest date a zip can say, so the same simulation
  // always produces the same bytes.
  const DATE = (0 << 9) | (1 << 5) | 1;

  const entries = files.map(file => ({ ...file, nameBytes: encoder.encode(file.name), crc: crc32(file.data), offset: 0 }));
  const localSize = entries.reduce((sum, e) => sum + 30 + e.nameBytes.length + e.data.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.nameBytes.length, 0);

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let at = 0;

  for (const entry of entries) {
    entry.offset = at;
    view.setUint32(at, 0x04034B50, true);
    view.setUint16(at + 4, 20, true);        // version needed
    view.setUint16(at + 6, 0x0800, true);    // names are UTF-8
    view.setUint16(at + 8, 0, true);         // stored
    view.setUint16(at + 10, 0, true);        // time
    view.setUint16(at + 12, DATE, true);
    view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.data.length, true);
    view.setUint32(at + 22, entry.data.length, true);
    view.setUint16(at + 26, entry.nameBytes.length, true);
    view.setUint16(at + 28, 0, true);
    out.set(entry.nameBytes, at + 30);
    out.set(entry.data, at + 30 + entry.nameBytes.length);
    at += 30 + entry.nameBytes.length + entry.data.length;
  }

  const centralStart = at;
  for (const entry of entries) {
    view.setUint32(at, 0x02014B50, true);
    view.setUint16(at + 4, 20, true);        // made by
    view.setUint16(at + 6, 20, true);        // needed
    view.setUint16(at + 8, 0x0800, true);
    view.setUint16(at + 10, 0, true);
    view.setUint16(at + 12, 0, true);
    view.setUint16(at + 14, DATE, true);
    view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.data.length, true);
    view.setUint32(at + 24, entry.data.length, true);
    view.setUint16(at + 28, entry.nameBytes.length, true);
    view.setUint16(at + 30, 0, true);        // extra
    view.setUint16(at + 32, 0, true);        // comment
    view.setUint16(at + 34, 0, true);        // disk
    view.setUint16(at + 36, 0, true);        // internal attributes
    view.setUint32(at + 38, 0, true);        // external attributes
    view.setUint32(at + 42, entry.offset, true);
    out.set(entry.nameBytes, at + 46);
    at += 46 + entry.nameBytes.length;
  }

  view.setUint32(at, 0x06054B50, true);
  view.setUint16(at + 4, 0, true);
  view.setUint16(at + 6, 0, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, at - centralStart, true);
  view.setUint32(at + 16, centralStart, true);
  view.setUint16(at + 20, 0, true);

  return out;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/*
 * A chart is five parts, not one.
 *
 * The chart itself; a drawing that says where on the sheet it sits; a
 * relationship from the sheet to that drawing and another from the drawing to
 * the chart; and an entry in [Content_Types] for each new part. Miss any of
 * them and Excel does not draw a wrong chart - it refuses to open the file
 * and calls it corrupt. That is why this is the last thing in the writer and
 * why its surface is two kinds of chart and nothing else.
 */

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const DRAW_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const SHEET_DRAW_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

/** A range as a chart has to name it: sheet, quoted, and absolute cells. */
function rangeRef(sheet: string, col: number, fromRow: number, toRow: number): string {
  // A quote inside a sheet name is doubled, as in a formula.
  const name = sheet.replace(/'/g, "''");
  return `'${name}'!$${columnName(col)}$${fromRow}:$${columnName(col)}$${toRow}`;
}

function chartXml(chart: ChartSpec, sheetName: string): string {
  const { fromRow, toRow } = chart.categories;
  const cats = `<c:cat><c:strRef><c:f>${escape(rangeRef(sheetName, chart.categories.col, fromRow, toRow))}</c:f></c:strRef></c:cat>`;

  const series = chart.series.map((one, at) =>
    '<c:ser>'
    + `<c:idx val="${at}"/><c:order val="${at}"/>`
    + `<c:tx><c:v>${escape(one.name)}</c:v></c:tx>`
    + cats
    + `<c:val><c:numRef><c:f>${escape(rangeRef(sheetName, one.col, fromRow, toRow))}</c:f></c:numRef></c:val>`
    + '</c:ser>').join('');

  // Two arbitrary but stable ids: a chart's axes refer to each other by them.
  const catAxis = 111111111;
  const valAxis = 222222222;

  const plot = chart.kind === 'doughnut'
    ? '<c:doughnutChart>'
      + '<c:varyColors val="1"/>'
      + series
      + '<c:firstSliceAng val="0"/><c:holeSize val="55"/>'
      + '</c:doughnutChart>'
    : '<c:barChart>'
      + '<c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>'
      + series
      + '<c:gapWidth val="60"/>'
      + `<c:axId val="${catAxis}"/><c:axId val="${valAxis}"/>`
      + '</c:barChart>'
      + `<c:catAx><c:axId val="${catAxis}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
      + `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${valAxis}"/></c:catAx>`
      + `<c:valAx><c:axId val="${valAxis}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
      + `<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="${catAxis}"/></c:valAx>`;

  return HEADER
    + `<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${DRAW_NS}" xmlns:r="${RELS}">`
    + '<c:chart>'
    + '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>'
    + `<a:t>${escape(chart.title)}</a:t>`
    + '</a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>'
    + '<c:autoTitleDeleted val="0"/>'
    + `<c:plotArea><c:layout/>${plot}</c:plotArea>`
    // A single series names itself in the title, so its legend is noise; a
    // doughnut's legend is the only thing naming its slices.
    + (chart.kind === 'doughnut' || chart.series.length > 1
      ? '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>'
      : '')
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>'
    + '</c:chart></c:chartSpace>';
}

/** Where on the sheet each chart sits, as a box between two cells. */
function drawingXml(charts: readonly ChartSpec[]): string {
  const anchors = charts.map((chart, at) => {
    const cell = (col: number, row: number) =>
      `<xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff>`
      + `<xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;

    return '<xdr:twoCellAnchor>'
      + `<xdr:from>${cell(chart.at.col, chart.at.row)}</xdr:from>`
      + `<xdr:to>${cell(chart.at.col + chart.at.width, chart.at.row + chart.at.height)}</xdr:to>`
      + '<xdr:graphicFrame macro="">'
      + '<xdr:nvGraphicFramePr>'
      + `<xdr:cNvPr id="${at + 2}" name="Chart ${at + 1}"/>`
      + '<xdr:cNvGraphicFramePr/>'
      + '</xdr:nvGraphicFramePr>'
      + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
      + `<a:graphic><a:graphicData uri="${CHART_NS}">`
      + `<c:chart xmlns:c="${CHART_NS}" xmlns:r="${RELS}" r:id="rId${at + 1}"/>`
      + '</a:graphicData></a:graphic>'
      + '</xdr:graphicFrame>'
      + '<xdr:clientData/>'
      + '</xdr:twoCellAnchor>';
  }).join('');

  return HEADER
    + `<xdr:wsDr xmlns:xdr="${SHEET_DRAW_NS}" xmlns:a="${DRAW_NS}">${anchors}</xdr:wsDr>`;
}

/**
 * Which sheets carry charts, and which chart numbers are theirs.
 *
 * Charts are numbered across the whole file - chart1, chart2 - while drawings
 * are numbered by the sheet they belong to. Both numbers are decided here,
 * once, so the parts, the relationships and the content types cannot disagree
 * about them, which is the one way this goes wrong that Excel reports only as
 * "the file is corrupt".
 */
function drawnSheets(sheets: readonly SheetSpec[]): { sheet: number; charts: number[] }[] {
  const drawn: { sheet: number; charts: number[] }[] = [];
  let next = 1;

  sheets.forEach((sheet, at) => {
    const charts = sheet.charts ?? [];
    if (charts.length === 0) return;
    drawn.push({ sheet: at + 1, charts: charts.map(() => next++) });
  });

  return drawn;
}

/** The drawing and chart parts, and the relationships that tie them on. */
function chartParts(sheets: readonly SheetSpec[]): [string, string][] {
  const parts: [string, string][] = [];

  for (const one of drawnSheets(sheets)) {
    const sheet = sheets[one.sheet - 1];
    const charts = sheet.charts ?? [];

    // The sheet points at its drawing...
    parts.push([`xl/worksheets/_rels/sheet${one.sheet}.xml.rels`, HEADER
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + `<Relationship Id="rId1" Type="${RELS}/drawing" Target="../drawings/drawing${one.sheet}.xml"/>`
      + '</Relationships>']);

    // ...the drawing says where each chart sits...
    parts.push([`xl/drawings/drawing${one.sheet}.xml`, drawingXml(charts)]);

    // ...and points at the charts themselves.
    parts.push([`xl/drawings/_rels/drawing${one.sheet}.xml.rels`, HEADER
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + one.charts.map((number, at) =>
        `<Relationship Id="rId${at + 1}" Type="${RELS}/chart" Target="../charts/chart${number}.xml"/>`).join('')
      + '</Relationships>']);

    one.charts.forEach((number, at) => {
      parts.push([`xl/charts/chart${number}.xml`, chartXml(charts[at], sheet.name)]);
    });
  }

  return parts;
}
