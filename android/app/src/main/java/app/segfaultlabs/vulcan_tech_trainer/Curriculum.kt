package app.segfaultlabs.vulcan_tech_trainer

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject

data class Step(val title: String, val body: String)
data class Move(val name: String, val start: Double, val end: Double, val description: String,
    val grip: String, val stance: String, val focus: String, val steps: List<Step>,
    val hasMotion: Boolean, val demonstration: Boolean)
data class Lesson(val id: String, val videoId: String, val series: String, val order: Int,
    val title: String, val summary: String, val href: String, val moves: List<Move>,
    val setup: Map<String, String>, val pitfalls: List<String>, val limitations: List<String>,
    val evidence: List<Pair<Double, String>>, val prerequisites: List<String>) {
    val seriesLabel get() = if (series == "beginner") "Basics" else "Antibrids"
    fun sourceUrl(index: Int) = "https://www.youtube.com/watch?v=$videoId&t=${moves[index].start.toInt()}s"
}
data class SearchResult(val lesson: Lesson, val move: Int?)
class Curriculum(val lessons: List<Lesson>) {
    fun lesson(id: String?) = lessons.firstOrNull { it.id == id }
    fun search(query: String): List<SearchResult> {
        val words = query.lowercase().trim().split(Regex("\\s+")).filter(String::isNotEmpty)
        if (words.isEmpty()) return lessons.map { SearchResult(it, null) }
        return lessons.flatMap { lesson ->
            val lessonText = "${lesson.title} ${lesson.summary}".lowercase()
            if (words.all { it in lessonText }) listOf(SearchResult(lesson, null)) else
                lesson.moves.mapIndexedNotNull { i, move ->
                    val text = "${lesson.title} ${move.name} ${move.description} ${move.grip} ${move.focus}".lowercase()
                    if (words.all { it in text }) SearchResult(lesson, i) else null
                }
        }
    }
    companion object {
        fun load(context: Context) = parse(context.assets.open("site/assets/catalog.json").bufferedReader().use { it.readText() })
        fun parse(text: String): Curriculum {
            val lessons = JSONArray(text).objects().flatMap { series -> series.getJSONArray("entries").objects().map { l ->
                val setup = l.getJSONObject("setup")
                Lesson(l.getString("id"), l.getString("videoId"), l.getString("series"), l.getInt("order"),
                    l.getString("title"), l.getString("summary"), l.getString("href"),
                    l.getJSONArray("moves").objects().map { m ->
                        Move(m.getString("name"),m.getDouble("start"),m.getDouble("end"),m.getString("description"),
                            m.getString("grip"),m.getString("stance"),m.getString("focus"),
                            m.getJSONArray("steps").objects().map { Step(it.getString("title"), it.getString("body")) },
                            m.optJSONObject("motion") != null, m.optBoolean("demonstrationOnly"))
                    }, listOf("grip","stance","plane").associateWith { setup.getString(it) },
                    l.optJSONArray("pitfalls").strings(), l.optJSONArray("limitations").strings(),
                    l.optJSONArray("evidence")?.objects()?.map { it.getDouble("time") to it.getString("observation") } ?: emptyList(),
                    l.optJSONArray("prerequisites").strings())
            } }
            require(lessons.map { it.id }.distinct().size == lessons.size)
            require(lessons.all { it.moves.isNotEmpty() && it.moves.all { m -> m.start >= 0 && m.end > m.start } })
            return Curriculum(lessons)
        }
    }
}
private fun JSONArray.objects() = (0 until length()).map(::getJSONObject)
private fun JSONArray?.strings(): List<String> = this?.let { a -> (0 until a.length()).map(a::getString) } ?: emptyList()
fun timestamp(seconds: Double) = "%d:%02d".format(seconds.toInt()/60,seconds.toInt()%60)

class PracticeStore(context: Context) {
    private val preferences = context.getSharedPreferences("practice", Context.MODE_PRIVATE)
    var dark: Boolean
        get() = preferences.getBoolean("dark",true)
        set(value) { preferences.edit().putBoolean("dark",value).apply() }
    var keepAwake: Boolean
        get() = preferences.getBoolean("keepAwake",true)
        set(value) { preferences.edit().putBoolean("keepAwake",value).apply() }
    var outdoor: Boolean
        get() = preferences.getBoolean("outdoor",false)
        set(value) { preferences.edit().putBoolean("outdoor",value).apply() }
    val lastLesson get() = preferences.getString("lastLesson",null)
    fun currentMove(id: String) = preferences.getInt("move.$id",0)
    fun remember(lesson: Lesson, index: Int) { preferences.edit().putString("lastLesson",lesson.id).putInt("move.${lesson.id}",index).apply() }
    fun practiced(id: String) = preferences.getBoolean("practiced.$id",false)
    fun setPracticed(id: String, value: Boolean) { preferences.edit().putBoolean("practiced.$id",value).apply() }
    fun video(videoId: String): Uri? = preferences.getString("video.$videoId",null)?.let(Uri::parse)
    fun attach(videoId: String, uri: Uri?) {
        if(uri == null) preferences.edit().remove("video.$videoId").apply()
        else preferences.edit().putString("video.$videoId",uri.toString()).apply()
    }
}
