const { withAndroidManifest } = require('expo/config-plugins');

// expo-camera (barcode_ui) y el módulo quitar-fondo (subject_segment) declaran
// el mismo meta-data de ML Kit con valores distintos y el manifest merger
// falla. Se declara una sola vez en el manifest de la app con ambos valores.
const NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const VALUE = 'barcode_ui,subject_segment';

module.exports = function withMlkitDependencies(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app['meta-data'] = (app['meta-data'] ?? []).filter((m) => m.$['android:name'] !== NAME);
    app['meta-data'].push({ $: { 'android:name': NAME, 'android:value': VALUE, 'tools:replace': 'android:value' } });
    return cfg;
  });
};
