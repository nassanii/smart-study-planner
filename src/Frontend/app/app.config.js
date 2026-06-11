const fs = require("fs");

const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined);

module.exports = {
  expo: {
    name: "Smart Study Planner",
    slug: "smart-study-planner",
    scheme: "smartstudyplanner",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.smartstudyplanner.app",
    },
    android: {
      package: "com.smartstudyplanner.app",
      ...(googleServicesFile ? { googleServicesFile } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-font",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#ffffff",
        },
      ],
      "expo-router",
    ],
    extra: {
      apiBaseUrl: "http://localhost:5080/api/v1",
      eas: {
        projectId: "e3c88455-4c49-4223-b3d7-37f4ab6ef8af",
      },
    },
    owner: "nassani",
  },
};
