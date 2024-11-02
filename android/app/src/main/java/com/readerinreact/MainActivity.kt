package com.readerinreact

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.ReactContext
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ReaderInReact"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
      super.onCreate(savedInstanceState)
      // 由于reactManager正常获取值为null,因此在创建阶段手动进行初始化
      val reactManager = reactNativeHost.reactInstanceManager
      // 手动初始化可能有暂未发现的隐患，若能解决初始化问题将以下代码注释
      reactManager.createReactContextInBackground()
  }
    
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    Log.d("MainActivity", "dispatchKeyEvent: ${event.keyCode}")
    if (event.action == KeyEvent.ACTION_DOWN) {
        when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN -> {
                val reactManager = reactNativeHost.reactInstanceManager
                val reactContext: ReactContext? = reactManager.currentReactContext
                if (reactContext != null) {
                    val volumeModule = reactContext.getNativeModule(VolumeModule::class.java)
                    if (volumeModule != null) {
                        //volumeModule.onKeyDown(event.keyCode) // 原本想采用的主动通信方式，已弃用
                        volumeModule.setKeyCodeInner(event.keyCode)
                    } else {
                        Log.e("MainActivity", "VolumeModule is null")
                    }
                } else {
                    Log.e("MainActivity", "ReactContext is null")
                }
                return true
            }
        }
    }
    return super.dispatchKeyEvent(event)
  }
  
}
