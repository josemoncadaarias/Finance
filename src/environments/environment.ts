// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  /**
   * The Google project this app signs in to, for keeping a copy in Drive.
   *
   * Empty until Jose creates it: the sign-in screen says so plainly rather
   * than offering a button that cannot work. It is the WEB client id even on
   * Android - that is what Google's own sign-in expects, and the Android
   * client id is registered beside it but never named here.
   *
   * A client id is not a secret. It identifies the app, it does not authorise
   * anything, and it is visible in any app that ships one.
   */
  googleWebClientId: '76504816542-p6s2f3akpfkoaker8fojjlpqluvsgtfu.apps.googleusercontent.com',
};
