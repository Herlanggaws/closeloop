package com.saidloop.sample

import com.saidloop.sdk.Saidloop
import android.app.Application

class SampleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Saidloop.init(this, BuildConfig.SAIDLOOP_KEY, api = BuildConfig.SAIDLOOP_API)
        Saidloop.identify(userId = "sample_user", appVersion = "1.0")
    }
}
