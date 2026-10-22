package com.josemoncada.finance;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.MlKitException;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * The text of a photo or a screenshot of a statement (Jose, 2026-10-22).
 *
 * Google's on-device text recognition, through Google Play services: nothing
 * leaves the phone, nothing is paid per use, and the model is fetched by the
 * phone itself (the manifest asks for it at install). The app hands over the
 * image already turned upright and shrunk, as JPEG in base64, and gets back
 * each line with its box in the image's pixels - what `ocr-items.ts` lays
 * out for the statement reader. It reads nothing but the image it is given.
 */
@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

    @PluginMethod
    public void read(PluginCall call) {
        String data = call.getString("image");
        if (data == null || data.isEmpty()) {
            call.reject("no image");
            return;
        }
        Bitmap bitmap;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            call.reject("unreadable image");
            return;
        }
        if (bitmap == null) {
            call.reject("unreadable image");
            return;
        }
        final int width = bitmap.getWidth();
        final int height = bitmap.getHeight();
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener(text -> {
                    JSArray lines = new JSArray();
                    for (Text.TextBlock block : text.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            Rect box = line.getBoundingBox();
                            if (box == null) continue;
                            JSObject one = new JSObject();
                            one.put("text", line.getText());
                            one.put("left", box.left);
                            one.put("top", box.top);
                            one.put("right", box.right);
                            one.put("bottom", box.bottom);
                            lines.put(one);
                        }
                    }
                    JSObject answer = new JSObject();
                    answer.put("width", width);
                    answer.put("height", height);
                    answer.put("lines", lines);
                    recognizer.close();
                    call.resolve(answer);
                })
                .addOnFailureListener(e -> {
                    recognizer.close();
                    // The model still on its way from Google Play services.
                    boolean waiting = e instanceof MlKitException
                            && ((MlKitException) e).getErrorCode() == MlKitException.UNAVAILABLE;
                    call.reject(waiting ? "not ready" : "failed: " + e.getClass().getSimpleName());
                });
    }
}
