package com.josemoncada.finance;

import android.accounts.Account;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;

import java.util.Collections;

/**
 * A token for the Drive copy, asked of Google with nothing on screen.
 *
 * Signing in again on every start showed Android's "Accediendo a la cuenta"
 * bar each time the app opened (Jose, 2026-10-09). The copy does not need a
 * sign-in: only Drive's permission, which the account already gave. Google's
 * AuthorizationClient hands the token straight back when it was given, and
 * says it needs the person (`hasResolution`) when it was not - then this
 * answers no token and the app falls back to signing in.
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {

    @PluginMethod
    public void token(PluginCall call) {
        String scope = call.getString("scope", "");
        String email = call.getString("email", "");
        try {
            AuthorizationRequest.Builder request = AuthorizationRequest.builder()
                    .setRequestedScopes(Collections.singletonList(new Scope(scope)));
            if (email != null && !email.isEmpty()) request.setAccount(new Account(email, "com.google"));
            Identity.getAuthorizationClient(getContext())
                    .authorize(request.build())
                    .addOnSuccessListener(result -> {
                        JSObject answer = new JSObject();
                        String token = result.hasResolution() ? null : result.getAccessToken();
                        answer.put("token", token == null ? "" : token);
                        call.resolve(answer);
                    })
                    .addOnFailureListener(failure -> call.reject(String.valueOf(failure.getMessage())));
        } catch (Throwable failure) {
            call.reject(String.valueOf(failure.getMessage()));
        }
    }
}
