package app.segfaultlabs.vulcan_tech_trainer

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun LessonScreen(lesson: Lesson,index: Int,dark: Boolean,expanded: Boolean,store: PracticeStore,catalog: Curriculum,
                 onMove: (Int)->Unit,onOpen: (Lesson)->Unit,onExpand: (Boolean)->Unit,onNavigate: (String)->Unit) {
    val context=LocalContext.current
    val m=lesson.moves[index]
    val playerPath=remember(lesson.id) {"/trainer/?lesson=${lesson.id}&move=$index"}
    var source by rememberSaveable {mutableStateOf(false)}
    var auto by rememberSaveable {mutableStateOf(false)}
    var chooseMove by remember {mutableStateOf(false)}
    var video by remember {mutableStateOf(store.video(lesson.videoId))}
    var videoMessage by remember {mutableStateOf<String?>(null)}
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if(uri!=null) {
            try {
                context.contentResolver.takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION)
                store.attach(lesson.videoId,uri);video=uri;source=true;videoMessage=null
            } catch (_: SecurityException) {videoMessage="This location cannot keep access after restart. Choose a video in Downloads or device storage."}
        }
    }
    val scroll=rememberScrollState()
    Column(Modifier.fillMaxSize().then(if(!expanded)Modifier.verticalScroll(scroll) else Modifier)) {
        if(!expanded) Column(Modifier.padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Text("${lesson.seriesLabel} · ${lesson.order}",style=MaterialTheme.typography.labelMedium,color=MaterialTheme.colorScheme.primary)
            Text(lesson.summary,style=MaterialTheme.typography.bodyMedium)
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                IconButton(onClick={onMove(index-1)},enabled=index>0){Icon(Icons.AutoMirrored.Filled.ArrowBack,"Previous move")}
                Box(Modifier.weight(1f)) {
                    TextButton(onClick={chooseMove=true},modifier=Modifier.fillMaxWidth()) {
                        Text("${index+1} / ${lesson.moves.size} · ${m.name}",Modifier.weight(1f),maxLines=2)
                        Icon(Icons.Default.ArrowDropDown,"Choose section")
                    }
                    DropdownMenu(chooseMove,{chooseMove=false},modifier=Modifier.heightIn(max=420.dp)) {
                        lesson.moves.forEachIndexed { i,move -> DropdownMenuItem(text={Text("${i+1}. ${move.name}")},onClick={onMove(i);chooseMove=false},trailingIcon={Text(timestamp(move.start),style=MaterialTheme.typography.labelSmall)}) }
                    }
                }
                IconButton(onClick={onMove(index+1)},enabled=index<lesson.moves.lastIndex){Icon(Icons.AutoMirrored.Filled.ArrowForward,"Next move")}
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                FilterChip(!source,{source=false},label={Text("3D study")})
                FilterChip(source,{source=true},label={Text("Source")})
            }
        }
        if(source) {
            Column(Modifier.then(if(expanded)Modifier.weight(1f) else Modifier).fillMaxWidth()) {
                if(video!=null) SourceVideo(video!!,lesson,index,auto,onMove,expanded,onExpand,Modifier.then(if(expanded)Modifier.weight(1f) else Modifier))
                else Text("Choose the downloaded source video to play this segment offline.",Modifier.padding(16.dp))
                if(!expanded) Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    Text("${timestamp(m.start)}–${timestamp(m.end)}",style=MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick={picker.launch(arrayOf("video/*"))}) {Text(if(video==null)"Choose video" else "Change video")}
                        TextButton(onClick={onNavigate(lesson.sourceUrl(index))}) {Text("YouTube ↗")}
                    }
                    if(video!=null) TextButton(onClick={store.attach(lesson.videoId,null);video=null}){Text("Forget selected video")}
                    videoMessage?.let {Text(it,color=MaterialTheme.colorScheme.error)}
                }
            }
        } else if(m.hasMotion) {
            BundledWeb(playerPath,dark,
                modifier=Modifier.fillMaxWidth().then(if(expanded)Modifier.weight(1f) else Modifier.height(520.dp)),
                lesson=lesson,move=index,autoAdvance=auto,onMove=onMove,onExpand=onExpand,onNavigate=onNavigate)
        } else Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text("No 3D study yet",style=MaterialTheme.typography.titleMedium)
            Text("Use the demonstration for this section.")
            OutlinedButton(onClick={source=true}){Text("View source")}
        }
        if(!expanded) Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(18.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {Checkbox(auto,{auto=it});Text("Auto-advance moves")}
            Text(m.name,style=MaterialTheme.typography.headlineSmall)
            Text(m.description)
            Cue("Grip",m.grip);Cue("Body and stance",m.stance);Cue("Look for",m.focus)
            TextButton(onClick={source=true}){Text("Source · ${timestamp(m.start)}–${timestamp(m.end)}")}
            Text(if(m.demonstration)"Observations" else "Steps",style=MaterialTheme.typography.titleLarge)
            m.steps.forEachIndexed { i,step -> Column(verticalArrangement=Arrangement.spacedBy(4.dp)) {Text("${i+1}. ${step.title}",fontWeight=FontWeight.Medium);Text(step.body)} }
            Disclosure("Before you begin") {lesson.setup.forEach { (key,value)->Cue(key.replaceFirstChar(Char::uppercase),value)} }
            Disclosure("Things to notice") {lesson.pitfalls.forEach {Text("• $it")} }
            if(lesson.limitations.isNotEmpty()) Disclosure("Diagram limits") {lesson.limitations.forEach {Text(it)} }
            if(lesson.evidence.isNotEmpty()) Disclosure("Source observations") {
                lesson.evidence.forEach { (time,note) ->
                    TextButton(onClick={onNavigate("https://www.youtube.com/watch?v=${lesson.videoId}&t=${time.toInt()}s")}) {Text("${timestamp(time)} · $note")}
                }
            }
            if(lesson.prerequisites.isNotEmpty()) Disclosure("Related lessons") {
                lesson.prerequisites.forEach { id -> catalog.lessons.firstOrNull {it.videoId==id||it.id==id}?.let {l->TextButton(onClick={onOpen(l)}){Text(l.title)}} }
            }
            HorizontalDivider()
            val at=catalog.lessons.indexOf(lesson)
            if(at>0) TextButton(onClick={onOpen(catalog.lessons[at-1])}){Text("← ${catalog.lessons[at-1].title}")}
            if(at<catalog.lessons.lastIndex) OutlinedButton(onClick={onOpen(catalog.lessons[at+1])},modifier=Modifier.fillMaxWidth()){Text("${catalog.lessons[at+1].title} →")}
        }
    }
}
@Composable
private fun Cue(title:String,body:String) {Column(verticalArrangement=Arrangement.spacedBy(4.dp)){Text(title,style=MaterialTheme.typography.labelLarge,color=MaterialTheme.colorScheme.onSurfaceVariant);Text(body)}}
@Composable
private fun Disclosure(title:String,content:@Composable ColumnScope.()->Unit) {
    var open by rememberSaveable {mutableStateOf(false)}
    Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        TextButton(onClick={open=!open},modifier=Modifier.fillMaxWidth()){Text(if(open)"− $title" else "+ $title",Modifier.fillMaxWidth())}
        if(open) content()
    }
}
