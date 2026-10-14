package app.segfaultlabs.vulcan_tech_trainer

import android.net.Uri
import android.graphics.Bitmap
import android.view.TextureView
import android.view.LayoutInflater
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun SourceVideo(uri: Uri,lesson: Lesson,index: Int,auto: Boolean,onMove:(Int)->Unit,
                expanded:Boolean,onExpand:(Boolean)->Unit,modifier:Modifier=Modifier) {
    val context=LocalContext.current
    val lifecycle=LocalLifecycleOwner.current.lifecycle
    var error by remember(uri) {mutableStateOf<String?>(null)}
    var speed by rememberSaveable {mutableFloatStateOf(.5f)}
    var loop by rememberSaveable {mutableStateOf(true)}
    var speeds by remember {mutableStateOf(false)}
    var continuePlaying by remember {mutableStateOf(false)}
    var playerView by remember {mutableStateOf<PlayerView?>(null)}
    var closeup by rememberSaveable {mutableStateOf(false)}
    var pick by remember {mutableStateOf(false)}
    var focus by remember {mutableStateOf(Offset(.5f,.5f))}
    var zoom by rememberSaveable {mutableFloatStateOf(3f)}
    var frame by remember {mutableStateOf<Bitmap?>(null)}
    var frameVersion by remember {mutableIntStateOf(0)}
    val player=remember(uri) { ExoPlayer.Builder(context).build().apply {
        setMediaItem(MediaItem.fromUri(uri));prepare();playWhenReady=false
        addListener(object:Player.Listener {override fun onPlayerError(e:PlaybackException){error="Video unavailable. Choose the downloaded video again."}})
    } }
    DisposableEffect(player,lifecycle) {
        val observer=LifecycleEventObserver {_,event->if(event==Lifecycle.Event.ON_PAUSE)player.pause()}
        lifecycle.addObserver(observer)
        onDispose {lifecycle.removeObserver(observer);player.release()}
    }
    LaunchedEffect(playerView,closeup,lifecycle) {
        if(!closeup){frame=null;return@LaunchedEffect}
        var bitmap:Bitmap?=null
        while(true) {
            val texture=playerView?.videoSurfaceView as? TextureView
            if(texture!=null&&texture.isAvailable&&texture.width>0&&texture.height>0&&lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                if(bitmap?.width!=texture.width||bitmap?.height!=texture.height)bitmap=Bitmap.createBitmap(texture.width,texture.height,Bitmap.Config.ARGB_8888)
                texture.getBitmap(bitmap!!)?.let {frame=it;frameVersion++}
            }
            delay(50)
        }
    }
    LaunchedEffect(player,index) {player.seekTo((lesson.moves[index].start*1000).toLong());player.playWhenReady=continuePlaying;continuePlaying=false}
    LaunchedEffect(player,speed) {player.setPlaybackSpeed(speed)}
    LaunchedEffect(player,index,loop,auto) {
        val start=(lesson.moves[index].start*1000).toLong();val end=(lesson.moves[index].end*1000).toLong()
        while(true) {
            delay(80)
            if((player.isPlaying && player.currentPosition>=end) || (player.playbackState==Player.STATE_ENDED && player.playWhenReady && player.currentPosition>=end-300)) {
                if(auto&&index<lesson.moves.lastIndex) {player.pause();continuePlaying=true;onMove(index+1);break}
                else if(loop) player.seekTo(start) else {player.pause();player.seekTo(end)}
            }
        }
    }
    Column(modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().then(if(expanded)Modifier.weight(1f) else Modifier.height(240.dp))) {
            AndroidView(factory={(LayoutInflater.from(it).inflate(R.layout.source_player,null) as PlayerView).apply {this.player=player;setShowNextButton(false);setShowPreviousButton(false);playerView=this}},modifier=Modifier.fillMaxSize())
            if(closeup) {
                val border=MaterialTheme.colorScheme.primary
                Canvas(Modifier.align(Alignment.TopEnd).padding(8.dp).size(160.dp,120.dp).clip(RoundedCornerShape(6.dp)).border(2.dp,border,RoundedCornerShape(6.dp)).semantics {contentDescription=if(frame!=null)"Video close-up" else "Loading video close-up"}) {
                    val image=frame
                    if(image!=null&&frameVersion>0) {
                        val width=(size.width/zoom).coerceAtMost(image.width.toFloat()).coerceAtMost(image.height*size.width/size.height).toInt().coerceAtLeast(1)
                        val height=(width*size.height/size.width).toInt().coerceIn(1,image.height)
                        val x=(focus.x*image.width-width/2).toInt().coerceIn(0,image.width-width)
                        val y=(focus.y*image.height-height/2).toInt().coerceIn(0,image.height-height)
                        drawImage(image.asImageBitmap(),srcOffset=IntOffset(x,y),srcSize=IntSize(width,height),dstSize=IntSize(size.width.toInt(),size.height.toInt()))
                    }
                }
            }
            if(pick) Box(Modifier.fillMaxSize().pointerInput(playerView) {detectTapGestures {point->
                val view=playerView;val surface=view?.videoSurfaceView
                if(view!=null&&surface!=null&&surface.width>0&&surface.height>0) {
                    val parent=IntArray(2);val child=IntArray(2);view.getLocationOnScreen(parent);surface.getLocationOnScreen(child)
                    focus=Offset(((point.x-child[0]+parent[0])/surface.width).coerceIn(0f,1f),((point.y-child[1]+parent[1])/surface.height).coerceIn(0f,1f))
                };pick=false
            }}) {Text("Tap the area to enlarge",Modifier.padding(12.dp),color=MaterialTheme.colorScheme.primary)}
        }
        error?.let {Text(it,Modifier.padding(16.dp),color=MaterialTheme.colorScheme.error)}
        Row(Modifier.fillMaxWidth().padding(horizontal=8.dp),horizontalArrangement=Arrangement.SpaceEvenly) {
            TextButton(onClick={player.pause();player.seekTo((player.currentPosition-250).coerceAtLeast((lesson.moves[index].start*1000).toLong()))}){Text("−0.25s")}
            TextButton(onClick={player.pause();player.seekTo((player.currentPosition+250).coerceAtMost((lesson.moves[index].end*1000).toLong()))}){Text("+0.25s")}
            Box {TextButton(onClick={speeds=true}){Text("${speed}×")};DropdownMenu(speeds,{speeds=false}) {
                listOf(.25f,.5f,.75f,1f,1.5f,2f).forEach {rate->DropdownMenuItem(text={Text("${rate}×")},onClick={speed=rate;speeds=false})}
            }}
            FilterChip(loop,{loop=!loop},label={Text("Loop")})
        }
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly) {
            TextButton(onClick={closeup=!closeup;if(!closeup)pick=false}){Text(if(closeup)"Close close-up" else "Close-up")}
            if(closeup) {
                TextButton(onClick={pick=true}){Text("Pick area")}
                TextButton(onClick={zoom=if(zoom>=5f)2f else zoom+1f}){Text("${zoom.toInt()}×")}
            }
            TextButton(onClick={onExpand(!expanded)}){Text(if(expanded)"Close full screen" else "Full screen")}
        }
    }
}
