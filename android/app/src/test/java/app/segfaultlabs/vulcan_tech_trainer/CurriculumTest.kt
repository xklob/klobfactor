package app.segfaultlabs.vulcan_tech_trainer
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

class CurriculumTest {
    private val bundle=File("build/generated/trainerAssets")
    private val bytes=File(bundle,"site/assets/catalog.json").readBytes()
    private val catalog=Curriculum.parse(bytes.toString(Charsets.UTF_8))
    @Test fun completeSharedCurriculumIsBundledUnchanged() {
        val manifest=JSONObject(File(bundle,"content-manifest.json").readText())
        val digest=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)}
        assertEquals(manifest.getString("catalogSha256"),digest)
        assertArrayEquals(File("../../dist/assets/catalog.json").readBytes(),bytes)
        assertEquals(21,catalog.lessons.size)
        assertEquals(150,catalog.lessons.sumOf {it.moves.size})
        assertEquals(listOf(13,8),catalog.lessons.groupBy {it.series}.values.map {it.size})
        catalog.lessons.groupBy {it.series}.values.forEach {assertEquals((1..it.size).toList(),it.map {l->l.order})}
        assertTrue(catalog.lessons.all {it.setup.values.all(String::isNotBlank)&&it.moves.all {m->m.steps.isNotEmpty()&&m.grip.isNotBlank()&&m.stance.isNotBlank()}})
    }
    @Test fun searchFindsMoveContentAndSourceTimestamps() {
        val results=catalog.search("pinky antispin")
        assertTrue(results.isNotEmpty());assertTrue(results.any {it.move!=null})
        val lesson=catalog.lessons.first()
        assertEquals("https://www.youtube.com/watch?v=tqJoUgprXws&t=44s",lesson.sourceUrl(0))
        assertEquals("3:37",timestamp(217.0))
        assertEquals(21,catalog.search("  ").size)
        assertTrue(catalog.search("nonexistentexamplexyz").isEmpty())
    }
    @Test fun referencesAndRendererHaveNoRemoteRuntimeDependency() {
        listOf("lab","vtg","reference").forEach {assertTrue(File(bundle,"site/$it/index.html").length()>1000)}
        listOf("three.module.js","three.core.js","OrbitControls.js").forEach {assertTrue(File(bundle,"site/assets/vendor/$it").isFile)}
        assertTrue(File(bundle,"site/trainer/trainer.mjs").isFile)
        assertFalse(bundle.walkTopDown().any {it.isFile&&it.extension in listOf("mp4","webm","jks","p12")})
    }
}
