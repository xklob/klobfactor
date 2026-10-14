package app.segfaultlabs.vulcan_tech_trainer

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import org.junit.Assert.*
import org.junit.Test
import org.junit.Before
import org.json.JSONObject
import android.view.View
import android.view.ViewGroup
import androidx.media3.ui.PlayerView
import androidx.media3.common.Player
import org.junit.runner.RunWith
import org.json.JSONTokener
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class TrainerDeviceTest {
    private val device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    @Before fun resetDebugPractice() {
        InstrumentationRegistry.getInstrumentation().targetContext.getSharedPreferences("practice",0).edit().clear().commit()
        androidx.test.uiautomator.Configurator.getInstance().waitForIdleTimeout=1000
    }
    private fun dragStage(s:ActivityScenario<MainActivity>) {
        val rect=JSONObject(JSONTokener(js(s,"JSON.stringify((()=>{const r=document.querySelector('.stage').getBoundingClientRect();return {x:r.x+r.width*.4,y:r.y+r.height*.5}})())")).nextValue() as String)
        val location=IntArray(2);var density=1f
        s.onActivity {it.activeWebView!!.getLocationOnScreen(location);density=it.resources.displayMetrics.density}
        val x=location[0]+(rect.getDouble("x")*density).toInt();val y=location[1]+(rect.getDouble("y")*density).toInt()
        device.swipe(x,y,x+100,y+40,20)
    }
    private fun js(scenario:ActivityScenario<MainActivity>,source:String):String {
        var result="";val latch=CountDownLatch(1)
        scenario.onActivity { activity ->
            val web=activity.activeWebView
            if(web==null) latch.countDown() else web.evaluateJavascript(source){result=it;latch.countDown()}
        }
        assertTrue("JavaScript evaluation timed out",latch.await(10,TimeUnit.SECONDS))
        return result
    }
    private fun waitJs(s:ActivityScenario<MainActivity>,expression:String) {
        val until=System.currentTimeMillis()+20000
        while(System.currentTimeMillis()<until) {if(js(s,expression)=="true")return;Thread.sleep(150)}
        fail("Web assertion failed: $expression; state="+js(s,"document.body.innerText.slice(0,700)"))
    }
    private fun settleFullscreen(s:ActivityScenario<MainActivity>?=null) {
        device.wait(Until.findObject(By.text("Got it")),2000)?.click()
        assertTrue(device.wait(Until.gone(By.desc("Back")),5000))
        Thread.sleep(500)
        if(s!=null) {
            val ready=CountDownLatch(1)
            s.onActivity {activity->val web=requireNotNull(activity.activeWebView)
                assertTrue("Expanded WebView height ${web.height}",web.height>=device.displayHeight-200)
                assertTrue(web.isShown)
                web.postVisualStateCallback(1,object:android.webkit.WebView.VisualStateCallback(){override fun onComplete(id:Long){ready.countDown()}})
            }
            assertTrue("Expanded frame was not ready",ready.await(10,TimeUnit.SECONDS))
            Thread.sleep(500)
            println("Expanded geometry: "+js(s,"JSON.stringify({viewport:[innerWidth,innerHeight],native:getComputedStyle(document.documentElement).getPropertyValue('--native-height'),stage:document.querySelector('.stage').getBoundingClientRect(),root:document.querySelector('.player-card').getBoundingClientRect()})"))
            waitJs(s,"document.querySelector('.stage').getBoundingClientRect().height>200")
        }
    }
    private fun tap(text:String) {
        assertTrue("Missing $text",device.wait(Until.hasObject(By.text(text)),10000))
        device.findObject(By.text(text)).click()
    }
    @Test fun offlineLessonViewerAndNativeNavigation() {
        ActivityScenario.launch(MainActivity::class.java).use {s->
            tap("Grip, timing & direction")
            repeat(3){device.findObject(By.desc("Next move")).click();Thread.sleep(200)}
            waitJs(s,"document.body.dataset.ready==='true' && !!document.querySelector('canvas')")
            assertEquals("\"beginner-01\"",js(s,"document.body.dataset.lesson"))
            waitJs(s,"document.body.dataset.move==='3' && document.querySelector('.stage').dataset.staffCount==='2'")
            assertEquals("\"isometric\"",js(s,"document.querySelector('[data-camera]').value"))
            dragStage(s)
            waitJs(s,"document.querySelector('[data-camera]').value==='free'")
            assertEquals("\"false\"",js(s,"document.querySelector('.stage').dataset.bodyAnimated"))
            js(s,"document.querySelector('[data-action=play]').click()")
            Thread.sleep(500)
            assertNotEquals("\"0\"",js(s,"document.querySelector('input[type=range]').value"))
            js(s,"window.trainer.pause();document.querySelector('[data-action=expand]').click()")
            waitJs(s,"document.body.dataset.expanded==='true'")
            settleFullscreen(s)
            device.takeScreenshot(File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"trainer-theater.png"))
            val screenshot=InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
            val colors=mutableSetOf<Int>();for(y in 100 until screenshot.height-100 step 16)for(x in 10 until screenshot.width-10 step 16)colors.add(screenshot.getPixel(x,y))
            assertTrue("Expanded view rendered blank",colors.size>20)
            device.pressBack()
            waitJs(s,"document.body.dataset.expanded!=='true'")
            device.findObject(By.desc("Mark practiced")).click()
            device.pressBack()
            tap("Continue")
            waitJs(s,"document.body.dataset.move==='3'")
            s.recreate()
            waitJs(s,"document.body.dataset.move==='3'")
            device.pressBack()
            tap("Lab")
            waitJs(s,"!!document.querySelector('#lab-player canvas')")
            js(s,"document.querySelector('#lab-pattern').value='antispin';document.querySelector('#lab-pattern').dispatchEvent(new Event('change'))")
            waitJs(s,"document.querySelector('.stage').dataset.staffCount==='2'")
            tap("VTG")
            waitJs(s,"document.body.innerText.includes('Reference poster')")
            tap("More")
            tap("Reference and sources")
            waitJs(s,"document.body.innerText.includes('Diagram limits')")
            assertEquals("false",js(s,"!!document.querySelector('iframe')"))
        }
    }
    private fun sourcePlayer(s:ActivityScenario<MainActivity>,action:(Player)->Unit) {
        fun find(view:View):PlayerView? {
            if(view is PlayerView)return view
            if(view is ViewGroup)for(i in 0 until view.childCount){val match=find(view.getChildAt(i));if(match!=null)return match}
            return null
        }
        s.onActivity {action(requireNotNull(find(it.window.decorView)?.player))}
    }
    private fun waitVideo(s:ActivityScenario<MainActivity>) {
        val until=System.currentTimeMillis()+15000
        while(System.currentTimeMillis()<until){var ready=false;sourcePlayer(s){ready=it.playbackState==Player.STATE_READY};if(ready)return;Thread.sleep(150)}
        fail("Local source video did not become ready")
    }
    @Test fun localVideoSelectionSurvivesRestart() {
        ActivityScenario.launch(MainActivity::class.java).use {s->
            tap("Grip, timing & direction")
            tap("Source");tap("Choose video")
            if(!device.wait(Until.hasObject(By.text("trainer-qa-source.mp4")),2000)) {
                device.wait(Until.findObject(By.desc("Show roots")),5000)?.click()
                device.wait(Until.hasObject(By.text("Downloads")),5000)
                device.findObjects(By.text("Downloads")).lastOrNull()?.click()
            }
            tap("trainer-qa-source.mp4")
            assertTrue(device.wait(Until.hasObject(By.text("Change video")),10000))
            waitVideo(s)
            sourcePlayer(s){assertTrue(it.currentPosition in 44000..45000);it.play()}
            Thread.sleep(800)
            sourcePlayer(s){assertTrue(it.currentPosition>44000);it.pause()}
            tap("0.5×");tap("0.25×")
            sourcePlayer(s){assertEquals(.25f,it.playbackParameters.speed,.001f)}
            tap("+0.25s")
            tap("Close-up")
            assertTrue(device.wait(Until.hasObject(By.desc("Video close-up")),5000))
            val inset=device.findObject(By.desc("Video close-up")).visibleBounds
            val capture=InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
            val samples=mutableSetOf<Int>();for(y in inset.top+8 until inset.bottom-8 step 8)for(x in inset.left+8 until inset.right-8 step 8)samples.add(capture.getPixel(x,y))
            assertTrue("Close-up did not render source pixels",samples.size>30)
            assertTrue(device.wait(Until.hasObject(By.text("Pick area")),5000))
            tap("Pick area")
            val selected=IntArray(2)
            s.onActivity {activity->
                fun find(view:View):PlayerView? {if(view is PlayerView)return view;if(view is ViewGroup)for(i in 0 until view.childCount){val match=find(view.getChildAt(i));if(match!=null)return match};return null}
                val surface=requireNotNull(find(activity.window.decorView)?.videoSurfaceView)
                surface.getLocationOnScreen(selected);selected[0]+=surface.width/3;selected[1]+=surface.height/2
            }
            device.click(selected[0],selected[1])
            assertTrue(device.wait(Until.gone(By.text("Tap the area to enlarge")),5000))
            Thread.sleep(250)
            device.takeScreenshot(File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"trainer-video-closeup.png"))
            tap("Close close-up")
            s.onActivity {assertNotNull(it.practice.video("tqJoUgprXws"))}
            s.recreate()
            assertTrue(device.wait(Until.hasObject(By.text("Change video")),10000))
            waitVideo(s)
            assertFalse(device.hasObject(By.textContains("Video unavailable")))
            tap("Full screen")
            assertTrue(device.wait(Until.hasObject(By.text("Close full screen")),5000))
            settleFullscreen()
            device.takeScreenshot(File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"trainer-video.png"))
            device.pressBack()
            assertTrue(device.wait(Until.gone(By.text("Close full screen")),5000))
            UiScrollable(UiSelector().scrollable(true)).scrollIntoView(UiSelector().text("Forget selected video"))
            tap("Forget selected video")
            assertTrue(device.wait(Until.hasObject(By.text("Choose video")),5000))
        }
    }
    @Test fun allLessonMotionsLoadFromTheBundledCatalog() {
        ActivityScenario.launch(MainActivity::class.java).use {s->
            tap("Grip, timing & direction")
            repeat(3){device.findObject(By.desc("Next move")).click();Thread.sleep(200)}
            waitJs(s,"document.body.dataset.ready==='true'")
            js(s,"window.coverage={done:false,errors:[],count:0};(async()=>{const all=(await fetch('/assets/catalog.json').then(r=>r.json())).flatMap(s=>s.entries);for(const l of all)for(let i=0;i<l.moves.length;i++){try{window.trainer.select(l.id,i);if(l.moves[i].motion && !document.querySelector('canvas'))throw new Error('missing renderer');window.coverage.count++;}catch(e){window.coverage.errors.push(l.id+':'+i+':'+e.message);}await new Promise(r=>setTimeout(r,5));}window.coverage.done=true;})()")
            waitJs(s,"window.coverage?.done===true")
            assertEquals("150",js(s,"window.coverage.count"))
            assertEquals("[]",js(s,"window.coverage.errors"))
        }
    }
}
