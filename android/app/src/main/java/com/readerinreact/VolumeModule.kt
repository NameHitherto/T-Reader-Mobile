package com.readerinreact

import android.content.Context
import android.media.AudioManager
import android.util.Log
import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = VolumeModule.NAME)
class VolumeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        const val NAME = "VolumeModule"
        // JS端和原生代码端共享此值
        var sharedKeyCode: Int = 0
    }

    private val audioManager: AudioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    override fun getName() = "VolumeModule"

    @ReactMethod
    fun getVolume(promise: Promise) {
        Log.d("MainActivity", "JSMODULE:${reactApplicationContext?.nativeModules}")
        try {
            val volume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            promise.resolve(volume)
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }

    @ReactMethod
    fun setVolume(volume: Int, promise: Promise) {
        try {
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, volume, 0)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }

    @ReactMethod
    fun getKeyCode(promise: Promise){
        try{
            Log.d("MainActivity","keyCodeGet:${sharedKeyCode}")
            promise.resolve(sharedKeyCode)
        }catch (e: Exception){
            promise.reject("Error", e)
        }
    }

    @ReactMethod
    fun setKeyCode(keyCode: Int, promise: Promise){
        try{
            sharedKeyCode = keyCode
            promise.resolve(null)
        }catch (e: Exception){
            promise.reject("Error", e)
        }
    }

    fun setKeyCodeInner(keyCode: Int){
        sharedKeyCode = keyCode
        Log.d("MainActivity","keyCodeSet:${sharedKeyCode}")
    }

    fun onKeyDown(keyCode: Int) {
        when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> sendEvent("onVolumeKeyPress", "volume_up")
            KeyEvent.KEYCODE_VOLUME_DOWN -> sendEvent("onVolumeKeyPress", "volume_down")
        }
    }

    private fun sendEvent(eventName: String, params: Any?) {
        Log.d("MainActivity", "JSMODULE:${reactApplicationContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).toString()}")
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Set up any upstream listeners or background tasks as necessary
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Remove upstream listeners, stop unnecessary background tasks
    }
}