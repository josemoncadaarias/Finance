package com.josemoncada.finance;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.speech.RecognizerIntent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * The phone's own dictation for the assistant (Jose, 2026-10-19, mockup 39h).
 *
 * It hands the listening to the phone's speech service through
 * RecognizerIntent, so the app asks for no microphone permission and keeps
 * no audio: the phone shows its own "Habla ahora" and gives back the words.
 * What happens to the audio is the phone's speech service's business (on most
 * phones Google's), which the privacy policy says.
 */
@CapacitorPlugin(name = "Speech")
public class SpeechPlugin extends Plugin {

    @PluginMethod
    public void available(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        JSObject answer = new JSObject();
        answer.put("available", intent.resolveActivity(getContext().getPackageManager()) != null);
        call.resolve(answer);
    }

    @PluginMethod
    public void listen(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "es-CO"));
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", ""));
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(call, intent, "heard");
        } catch (ActivityNotFoundException missing) {
            call.reject("unavailable");
        } catch (Throwable failure) {
            call.reject(String.valueOf(failure.getMessage()));
        }
    }

    @ActivityCallback
    private void heard(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject answer = new JSObject();
        String text = "";
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            ArrayList<String> words = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (words != null && !words.isEmpty()) text = words.get(0);
        }
        answer.put("text", text);
        call.resolve(answer);
    }
}
