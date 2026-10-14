package app.segfaultlabs.vulcan_tech_trainer

import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    var activeWebView: WebView? = null
    lateinit var curriculum: Curriculum
    lateinit var practice: PracticeStore
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if(BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        curriculum=Curriculum.load(this);practice=PracticeStore(this)
        setContent { TrainerApp(this) }
    }
    fun external(url: String) {
        val uri=android.net.Uri.parse(url)
        if(uri.scheme !in listOf("https","http")) return
        runCatching { startActivity(Intent(Intent.ACTION_VIEW,uri)) }.onFailure {
            android.widget.Toast.makeText(this,"No app available to open this link.",android.widget.Toast.LENGTH_SHORT).show()
        }
    }
    fun closeExpanded() {
        activeWebView?.evaluateJavascript("window.nativeExit?.();",null)
    }
}
private val DarkColors=darkColorScheme(primary=Color(0xFF8AACF8),secondary=Color(0xFFF1A17C),
    primaryContainer=Color(0xFF26385D),secondaryContainer=Color(0xFF27334D),onSecondaryContainer=Color(0xFFB9CEFF),
    background=Color(0xFF111216),surface=Color(0xFF111216),surfaceContainer=Color(0xFF1B1D23),
    surfaceContainerHigh=Color(0xFF24262D),onBackground=Color(0xFFEDEDF0),onSurface=Color(0xFFEDEDF0),
    onSurfaceVariant=Color(0xFFB2B4BE),outline=Color(0xFF424550))
private val LightColors=lightColorScheme(primary=Color(0xFF315EAF),secondary=Color(0xFFA14F2F),
    background=Color(0xFFF8F7F4),surface=Color(0xFFF8F7F4),surfaceContainer=Color(0xFFECEBF0))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrainerApp(activity: MainActivity) {
    val store=activity.practice;val catalog=activity.curriculum
    var dark by remember { mutableStateOf(store.dark) }
    var awake by remember { mutableStateOf(store.keepAwake) }
    var outdoor by remember { mutableStateOf(store.outdoor) }
    var tab by rememberSaveable { mutableStateOf("lessons") }
    var lessonId by rememberSaveable { mutableStateOf<String?>(null) }
    var move by rememberSaveable { mutableIntStateOf(0) }
    var webPath by rememberSaveable { mutableStateOf("/lab/") }
    var expanded by remember { mutableStateOf(false) }
    var revision by remember { mutableIntStateOf(0) }
    val lesson=catalog.lesson(lessonId)
    val practiced=remember(revision,lessonId) {lessonId?.let {store.practiced(it)}?:false}
    fun open(l: Lesson,index: Int=store.currentMove(l.id)) {
        lessonId=l.id;move=index.coerceIn(l.moves.indices);expanded=false;store.remember(l,move)
    }
    fun navigate(url: String) {
        val uri=android.net.Uri.parse(url)
        if(isBundledUrl(uri)) {
            val target=catalog.lessons.firstOrNull { it.href==uri.path }
            when {
                target!=null -> open(target,uri.getQueryParameter("move")?.toIntOrNull()?:0)
                uri.path?.startsWith("/lab")==true -> {lessonId=null;tab="lab";webPath=uri.encodedPath.orEmpty()+(uri.encodedQuery?.let {"?$it"}?:"")}
                uri.path?.startsWith("/vtg")==true -> {lessonId=null;tab="vtg"}
                uri.path?.startsWith("/reference")==true -> {lessonId=null;tab="reference"}
                else -> {lessonId=null;tab="lessons"}
            }
        } else activity.external(url)
    }
    LaunchedEffect(awake,outdoor,lessonId,tab,dark,expanded) {
        val practicing=lesson!=null||tab=="lab"
        if(awake&&practicing) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val attrs=activity.window.attributes
        attrs.screenBrightness=if(outdoor&&practicing) 1f else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        activity.window.attributes=attrs
        val insets=WindowCompat.getInsetsController(activity.window,activity.window.decorView)
        insets.systemBarsBehavior=WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        insets.isAppearanceLightStatusBars=!dark;insets.isAppearanceLightNavigationBars=!dark
        if(expanded) insets.hide(WindowInsetsCompat.Type.systemBars()) else insets.show(WindowInsetsCompat.Type.systemBars())
    }
    BackHandler(enabled=expanded||lesson!=null||tab!="lessons") {
        if(expanded){activity.closeExpanded();expanded=false}
        else if(lesson!=null) lessonId=null else tab="lessons"
    }
    MaterialTheme(colorScheme=if(dark)DarkColors else LightColors) {
        Scaffold(topBar={if(!expanded) TopAppBar(title={Text(if(lesson!=null) lesson.title else when(tab){"lessons"->"Lessons";"lab"->"Motion lab";"vtg"->"Vulcan tech";"reference"->"Reference";else->"Settings"},maxLines=1,style=MaterialTheme.typography.titleLarge)},
            navigationIcon={if(lesson!=null||tab=="reference") IconButton(onClick={lessonId=null;if(tab=="reference")tab="settings"}){Icon(Icons.AutoMirrored.Filled.ArrowBack,"Back")}},
            actions={if(lesson!=null) IconButton(onClick={store.setPracticed(lesson.id,!store.practiced(lesson.id));revision++}) {Icon(if(practiced)Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,if(practiced)"Mark unpracticed" else "Mark practiced",tint=if(practiced)MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)}})
        },bottomBar={if(!expanded&&lesson==null) NavigationBar {
            listOf("lessons" to Icons.AutoMirrored.Filled.MenuBook,"lab" to Icons.Default.Tune,"vtg" to Icons.Default.Hub,"settings" to Icons.Default.MoreHoriz).forEach { (key,icon) ->
                NavigationBarItem(selected=tab==key||(key=="settings"&&tab=="reference"),onClick={tab=key;if(key=="lab")webPath="/lab/"},icon={Icon(icon,null)},label={Text(when(key){"lessons"->"Lessons";"lab"->"Lab";"vtg"->"VTG";else->"More"})})
            }
        }}) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                when {
                    lesson!=null -> key(lesson.id) { LessonScreen(lesson,move,dark,expanded,store,catalog,
                        onMove={move=it.coerceIn(lesson.moves.indices);store.remember(lesson,move)},onOpen={open(it,0)},
                        onExpand={expanded=it},onNavigate=::navigate) }
                    tab=="lessons" -> CurriculumScreen(catalog,store,revision,onOpen={l,i->open(l,i)})
                    tab=="lab" -> BundledWeb(webPath,dark,Modifier.fillMaxSize(),onExpand={expanded=it},onNavigate=::navigate)
                    tab=="vtg" -> BundledWeb("/vtg/",dark,Modifier.fillMaxSize(),onExpand={expanded=it},onNavigate=::navigate)
                    tab=="reference" -> BundledWeb("/reference/",dark,Modifier.fillMaxSize(),onExpand={expanded=it},onNavigate=::navigate)
                    else -> SettingsScreen(dark,awake,outdoor,onDark={dark=it;store.dark=it},onAwake={awake=it;store.keepAwake=it},onOutdoor={outdoor=it;store.outdoor=it},onReference={tab="reference"},onExternal=activity::external)
                }
            }
        }
    }
}
@Composable
private fun CurriculumScreen(catalog: Curriculum, store: PracticeStore, revision: Int, onOpen: (Lesson,Int)->Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val matches=remember(query){catalog.search(query)}
    LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        item { OutlinedTextField(query,{query=it},Modifier.fillMaxWidth(),placeholder={Text("Search lessons and moves")},leadingIcon={Icon(Icons.Default.Search,null)},singleLine=true) }
        if(query.isBlank()) {
            val last=catalog.lesson(store.lastLesson)
            if(last!=null) item {
                FilledTonalButton(onClick={onOpen(last,store.currentMove(last.id))},modifier=Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(vertical=4.dp)){Text("Continue",style=MaterialTheme.typography.labelMedium);Text(last.title);Text(last.moves[store.currentMove(last.id).coerceIn(last.moves.indices)].name,style=MaterialTheme.typography.bodySmall)}
                }
            }
            item { Text("21 lessons · 150 sections · Available offline",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant) }
        } else item {Text("${matches.size} results",style=MaterialTheme.typography.labelLarge)}
        itemsIndexed(matches,key={_,r->"${r.lesson.id}-${r.move}"}) { index,result ->
            val l=result.lesson
            Column {
                if(query.isBlank()&&(index==0||matches[index-1].lesson.series!=l.series)) Text(l.seriesLabel,Modifier.padding(top=12.dp,bottom=16.dp),style=MaterialTheme.typography.headlineSmall)
                ListItem(modifier=Modifier.clickable {onOpen(l,result.move?:store.currentMove(l.id))},
                    headlineContent={Text(result.move?.let {l.moves[it].name}?:l.title,fontWeight=FontWeight.Medium)},
                    supportingContent={Text(if(result.move==null) "${l.moves.size} sections" else l.title)},
                    leadingContent={Text("%02d".format(l.order),color=MaterialTheme.colorScheme.primary)},
                    trailingContent={if(store.practiced(l.id)){Icon(Icons.Default.Check,"Practiced",tint=MaterialTheme.colorScheme.primary)}else Icon(Icons.Default.ChevronRight,null)})
                HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant.copy(alpha=.4f))
            }
        }
        if(matches.isEmpty()) item {Text("No matching moves.")}
    }
}
@Composable
private fun SettingsScreen(dark:Boolean,awake:Boolean,outdoor:Boolean,onDark:(Boolean)->Unit,onAwake:(Boolean)->Unit,onOutdoor:(Boolean)->Unit,onReference:()->Unit,onExternal:(String)->Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
        SettingSwitch("Dark mode","Charcoal surfaces",dark,onDark)
        SettingSwitch("Keep screen awake","While practicing",awake,onAwake)
        SettingSwitch("Outdoor brightness","Maximum brightness while practicing",outdoor,onOutdoor)
        HorizontalDivider()
        Text("Offline",style=MaterialTheme.typography.titleMedium)
        Text("All lessons, explanations, diagrams, the motion lab, and reference pages are stored on this device. To practice with a source video offline, choose a downloaded video in its lesson.")
        Text("Source videos and the original VTG poster open in your browser and need a connection unless you have saved them. Practice records and selected video links stay on this device.",style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick=onReference){Text("Reference and sources")}
        HorizontalDivider()
        Text("Vulcan Tech Gospel (Trainer)",style=MaterialTheme.typography.titleMedium)
        Text("Android ${BuildConfig.VERSION_NAME}",style=MaterialTheme.typography.bodySmall)
        Text("Original teaching by DrexFactor. Independent companion; no affiliation or endorsement.",style=MaterialTheme.typography.bodyMedium)
        TextButton(onClick={onExternal("https://github.com/xklob/klobfactor")}){Text("Source and releases ↗")}
    }
}
@Composable
fun SettingSwitch(title:String,description:String,checked:Boolean,onChange:(Boolean)->Unit) {
    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end=16.dp)){Text(title,style=MaterialTheme.typography.titleMedium);Text(description,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)}
        Switch(checked,onChange,modifier=Modifier.semantics {contentDescription=title})
    }
}
