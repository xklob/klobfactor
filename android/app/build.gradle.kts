import java.util.Properties
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
val signingFile = providers.environmentVariable("VULCAN_SIGNING_PROPERTIES").orNull?.let(::File)
    ?: File(System.getProperty("user.home"), ".config/vulcan-tech-trainer/signing.properties")
val releaseSigning = if (signingFile.isFile) Properties().apply { signingFile.inputStream().use(::load) } else null
val prepareTrainerAssets by tasks.registering(Exec::class) {
    workingDir(rootProject.projectDir.parentFile)
    commandLine("node", "scripts/build-android-assets.mjs")
    inputs.files(fileTree("../../src"), fileTree("../../content"), fileTree("../viewer"), fileTree("../../scripts"), file("../../package.json"), file("../../package-lock.json"))
    outputs.dir(layout.buildDirectory.dir("generated/trainerAssets"))
}
android {
    namespace = "app.segfaultlabs.vulcan_tech_trainer"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.segfaultlabs.vulcan_tech_trainer"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures { compose = true; buildConfig = true }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/trainerAssets"))
    signingConfigs {
        if (releaseSigning != null) create("release") {
            storeFile = signingFile.parentFile.resolve(releaseSigning.getProperty("storeFile"))
            storePassword = releaseSigning.getProperty("storePassword")
            keyAlias = releaseSigning.getProperty("keyAlias")
            keyPassword = releaseSigning.getProperty("keyPassword")
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-debug" }
        release {
            if (releaseSigning != null) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    testOptions.unitTests.isReturnDefaultValues = true
}
kotlin { jvmToolchain(17) }
tasks.named("preBuild") { dependsOn(prepareTrainerAssets) }
dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.06.01"))
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("androidx.media3:media3-ui:1.11.1")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
}
