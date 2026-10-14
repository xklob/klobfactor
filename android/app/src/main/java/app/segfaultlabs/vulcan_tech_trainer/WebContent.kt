package app.segfaultlabs.vulcan_tech_trainer

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.view.MotionEvent
import android.webkit.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.activity.compose.LocalActivity
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.ByteArrayInputStream

private class PracticeWebView(context: Context) : WebView(context) {
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if(event.actionMasked == MotionEvent.ACTION_DOWN) parent?.requestDisallowInterceptTouchEvent(true)
        if(event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) parent?.requestDisallowInterceptTouchEvent(false)
        return super.onTouchEvent(event)
    }
}

const val ASSET_ORIGIN = "https://appassets.androidplatform.net"
fun isBundledUrl(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "appassets.androidplatform.net" && uri.port == -1 && uri.userInfo == null

class AssetClient(private val context: Context, private val navigate: (String) -> Unit,
                  private val finished: (WebView) -> Unit) : WebViewClient() {
    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse {
        val uri = request.url
        if (!isBundledUrl(uri) || request.method != "GET") return blocked()
        var path = uri.path.orEmpty().removePrefix("/")
        if (path.split('/').any { it == ".." || it == "." } || path.contains('\\')) return blocked()
        if (path.isEmpty() || path.endsWith('/')) path += "index.html"
        val mime = when(path.substringAfterLast('.')) {
            "html" -> "text/html"; "mjs", "js" -> "text/javascript"; "css" -> "text/css"
            "json" -> "application/json"; "svg" -> "image/svg+xml"; "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"; else -> "application/octet-stream"
        }
        return try {
            WebResourceResponse(mime, "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-cache", "X-Content-Type-Options" to "nosniff"),context.assets.open("site/$path"))
        } catch (_: java.io.IOException) { WebResourceResponse("text/plain","UTF-8",404,"Not found",emptyMap(),ByteArrayInputStream(ByteArray(0))) }
    }
    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return true
        if (isBundledUrl(request.url) && request.url.encodedPath == Uri.parse(view?.url).encodedPath && request.url.fragment != null) return false
        navigate(request.url.toString()); return true
    }
    override fun onPageFinished(view: WebView, url: String) { if(isBundledUrl(Uri.parse(url))) finished(view) }
    private fun blocked() = WebResourceResponse("text/plain","UTF-8",403,"Blocked",emptyMap(),ByteArrayInputStream(ByteArray(0)))
}
class TrainerBridge(private val activity: MainActivity, private val move: (Int) -> Unit, private val onExpanded: (Boolean) -> Unit) {
    @JavascriptInterface fun moveTo(index: Int) { activity.runOnUiThread { move(index) } }
    @JavascriptInterface fun expanded(value: Boolean) { activity.runOnUiThread { onExpanded(value) } }
    @JavascriptInterface fun ready() = Unit
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun BundledWeb(path: String, dark: Boolean, modifier: Modifier = Modifier, lesson: Lesson? = null,
               move: Int = 0, autoAdvance: Boolean = false, onMove: (Int) -> Unit = {},
               onExpand: (Boolean) -> Unit, onNavigate: (String) -> Unit) {
    val activity = LocalActivity.current as MainActivity
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val moveCallback by rememberUpdatedState(onMove)
    val expandCallback by rememberUpdatedState(onExpand)
    val navigateCallback by rememberUpdatedState(onNavigate)
    val currentMove by rememberUpdatedState(move)
    val currentDark by rememberUpdatedState(dark)
    val currentAuto by rememberUpdatedState(autoAdvance)
    fun sync(view: WebView) {
        val theme = if(currentDark) "dark" else "light"
        val select = lesson?.let { "window.nativeState={id:${org.json.JSONObject.quote(it.id)},move:$currentMove,auto:$currentAuto};window.trainer?.select(window.nativeState.id,$currentMove);if(window.trainer)window.trainer.autoAdvance=$currentAuto;" } ?: ""
        view.evaluateJavascript("document.documentElement.dataset.theme='$theme';localStorage.setItem('klobfactor-theme','$theme');$select",null)
        val density=view.resources.displayMetrics.density
        if(view.width>0&&view.height>0) view.evaluateJavascript("document.documentElement.style.setProperty('--native-height','${view.height/density}px');document.documentElement.style.setProperty('--native-width','${view.width/density}px');document.documentElement.classList.toggle('native-landscape',${view.width>view.height});",null)
        view.setBackgroundColor(if(currentDark) Color.rgb(17,18,22) else Color.rgb(248,247,244))
    }
    val web = remember(path) {
        PracticeWebView(activity).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mediaPlaybackRequiresUserGesture = true
            settings.textZoom = 100
            isVerticalScrollBarEnabled = false
            addJavascriptInterface(TrainerBridge(activity,{moveCallback(it)},{expandCallback(it)}),"Trainer")
            webViewClient = AssetClient(activity,{navigateCallback(it)}) { view ->
                sync(view)
            }
            addOnLayoutChangeListener { view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
                if(right-left!=oldRight-oldLeft||bottom-top!=oldBottom-oldTop) sync(view as WebView)
            }
            webChromeClient = WebChromeClient()
            loadUrl("$ASSET_ORIGIN$path")
        }
    }
    DisposableEffect(web,lifecycle) {
        activity.activeWebView = web
        val observer = LifecycleEventObserver { _, event ->
            if(event == Lifecycle.Event.ON_PAUSE) {
                web.evaluateJavascript("window.trainer?.pause();document.querySelectorAll('video').forEach(v=>v.pause());document.querySelectorAll('[data-action=play][aria-label=\"Pause animation\"]').forEach(b=>b.click());",null)
                web.onPause();web.pauseTimers()
            } else if(event == Lifecycle.Event.ON_RESUME) {web.onResume();web.resumeTimers()}
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            if(activity.activeWebView === web) activity.activeWebView = null
            web.evaluateJavascript("window.trainer?.destroy();",null)
            web.removeJavascriptInterface("Trainer")
            web.stopLoading();web.destroy()
        }
    }
    key(web) { AndroidView(factory={web},modifier=modifier,update={sync(it)}) }
}
