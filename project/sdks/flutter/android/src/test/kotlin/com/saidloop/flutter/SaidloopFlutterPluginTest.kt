package com.saidloop.flutter

import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.mockito.Mockito
import kotlin.test.Test

/*
 * Run with `./gradlew testDebugUnitTest` in `example/android/` after building the example once.
 */
internal class SaidloopFlutterPluginTest {
    @Test
    fun onMethodCall_unknownMethod_isNotImplemented() {
        val plugin = SaidloopFlutterPlugin()

        val call = MethodCall("doesNotExist", null)
        val mockResult: MethodChannel.Result = Mockito.mock(MethodChannel.Result::class.java)
        plugin.onMethodCall(call, mockResult)

        Mockito.verify(mockResult).notImplemented()
    }
}
