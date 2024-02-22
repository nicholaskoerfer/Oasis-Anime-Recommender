package com.example.kanshi;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@SuppressLint("SetJavaScriptEnabled")
public class MainService extends Service {
    public static WeakReference<MainService> weakActivity;
    MediaWebView webView;
    private String exportPath;
    public SharedPreferences prefs;
    private SharedPreferences.Editor prefsEdit;
    private boolean keepAppRunningInBackground = false;
    private boolean pageLoaded = false;
    public boolean appSwitched = false;
    private final String APP_IN_BACKGROUND_CHANNEL = "app_in_background_channel";
    private final int SERVICE_NOTIFICATION_ID = 995;
    private final String STOP_SERVICE_ACTION = "STOP_MAIN_SERVICE";
    private final String SET_MAIN_SERVICE = "SET_MAIN_SERVICE";
    final String uniqueKey = "Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70";
    final String isBackgroundUpdateKey = uniqueKey+".isBackgroundUpdate";
    final String visitedKey = uniqueKey+".visited";
    public boolean lastBackgroundUpdateIsFinished = false;
    public boolean lastBackgroundUpdateTimeIsAlreadyUpdated = false;
    public boolean isAddingAnimeReleaseNotification = false;
    public boolean shouldCallStopService = false;
    public boolean shouldRefreshList = false;
    public boolean shouldProcessRecommendationList = false;
    public boolean shouldLoadAnime = false;
    public long addedAnimeCount = 0;
    public long updatedAnimeCount = 0;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (STOP_SERVICE_ACTION.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
        } else if (SET_MAIN_SERVICE.equals(intent.getAction())) {
            if (ActivityCompat.checkSelfPermission(this.getApplicationContext(), android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                keepAppRunningInBackground = !keepAppRunningInBackground;
                MainActivity mainActivity = MainActivity.getInstanceActivity();
                if (mainActivity != null) {
                    mainActivity.changeKeepAppRunningInBackground(keepAppRunningInBackground);
                } else {
                    prefsEdit.putBoolean("keepAppRunningInBackground", keepAppRunningInBackground).apply();
                }
                updateNotificationTitle("");
            }
        }
        return START_REDELIVER_INTENT;
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    public void onCreate() {
        weakActivity = new WeakReference<>(MainService.this);
        super.onCreate();
        MainActivity mainActivity = MainActivity.getInstanceActivity();
        if (mainActivity!=null) {
            if (mainActivity.isInApp) {
                stopForeground(true);
                stopSelf();
                return;
            }
        }
        // Create a notification channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Background Application";
            String description = "Allow application in the background for updates, uses ram and power usage when update is running.";
            int importance = NotificationManager.IMPORTANCE_MIN;
            NotificationChannel channel = new NotificationChannel(APP_IN_BACKGROUND_CHANNEL, name, importance);
            channel.setDescription(description);
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
            channel.setSound(null, null);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }

        prefs = this.getSharedPreferences("com.example.kanshi", Context.MODE_PRIVATE);
        prefsEdit = prefs.edit();
        // Saved Data
        keepAppRunningInBackground = prefs.getBoolean("keepAppRunningInBackground",true);
        exportPath = prefs.getString("savedExportPath", "");

        webView = new MediaWebView(this);
        // Set WebView Settings
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setSaveFormData(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setBlockNetworkLoads(false);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        webView.addJavascriptInterface(new JSBridge(), "JSBridge");

        webView.addJavascriptInterface(new JSBridge(), "JSBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                boolean visited = prefs.getBoolean("visited", false);
                if (visited) {
                    view.loadUrl("javascript:(()=>window['"+visitedKey+"']=true)();");
                }
                view.loadUrl("javascript:(()=>window['"+isBackgroundUpdateKey+"']=true)();");
                if (appSwitched) {
                    appSwitched = false;
                    view.loadUrl("javascript:(()=>window.shouldUpdateNotifications=true)();");
                }
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (pageLoaded) {
                    CookieManager cookieManager = CookieManager.getInstance();
                    cookieManager.setAcceptCookie(true);
                    cookieManager.setAcceptThirdPartyCookies(view, true);
                    CookieManager.getInstance().acceptCookie();
                    CookieManager.getInstance().flush();
                } else if (!url.startsWith("file")) {
                    MainService.this.stopForeground(true);
                    MainService.this.stopSelf();
                    appSwitched = true;
                    pageLoaded = true;
                }
                updateNotificationTitle("");
                super.onPageFinished(view, url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            String message = consoleMessage.message();
            Log.d("WebConsole", message);
            return true;
            }
        });

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        // Start the service in the foreground
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Context context = this.getApplicationContext();
            // Stop Service
            Intent stopIntent = new Intent(context, MainService.class);
            stopIntent.setAction(STOP_SERVICE_ACTION);
            PendingIntent stopPendingIntent = PendingIntent.getService(context, 0, stopIntent, PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_MUTABLE);
            // Set Keep App In Background
            Intent setIntent = new Intent(context, MainService.class);
            setIntent.setAction(SET_MAIN_SERVICE);
            PendingIntent setPendingIntent = PendingIntent.getService(context, 0, setIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            // Open App
            PackageManager pm = context.getPackageManager();
            Intent intent = pm.getLaunchIntentForPackage("com.example.kanshi");
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new NotificationCompat.Builder(context, APP_IN_BACKGROUND_CHANNEL)
                    .setContentTitle("Kanshi.")
                    .setSmallIcon(R.drawable.ic_stat_name)
                    .setContentIntent(pendingIntent)
                    .addInvisibleAction(R.drawable.ic_stat_name, "OPEN", pendingIntent)
                    .addAction(keepAppRunningInBackground ? R.drawable.check_white : R.drawable.disabled_white, keepAppRunningInBackground ? "ENABLED" : "DISABLED", setPendingIntent)
                    .addAction(R.drawable.stop_white, "EXIT", stopPendingIntent)
                    .setOnlyAlertOnce(true)
                    .setOngoing(true)
                    .setSilent(true)
                    .setShowWhen(false)
                    .setNumber(0)
                    .build();
            try {
                startForeground(SERVICE_NOTIFICATION_ID, notification);
            } catch (Exception ex) {
                ex.printStackTrace();
                stopForeground(true);
                stopSelf();
                return;
            }
        }

        // Load Page
        appSwitched = true;
        pageLoaded = false;
        webView.loadUrl("https://u-kuro.github.io/Kanshi-Anime-Recommender/");
    }

    @Override
    public void onDestroy() {
        webView.destroy();
        AnimeNotificationManager.recentlyUpdatedAnimeNotification(MainService.this, addedAnimeCount, updatedAnimeCount);
        super.onDestroy();
    }

    public static MainService getInstanceActivity() {
        if (weakActivity!=null) {
            return weakActivity.get();
        } else {
            return null;
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    public void updateNotificationTitle(String title) {
        Context context = this.getApplicationContext();
        if (ActivityCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        // Stop Service
        Intent stopIntent = new Intent(context, MainService.class);
        stopIntent.setAction(STOP_SERVICE_ACTION);
        PendingIntent stopPendingIntent = PendingIntent.getService(context, 0, stopIntent, PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_MUTABLE);
        // Set Keep App In Background
        Intent setIntent = new Intent(context, MainService.class);
        setIntent.setAction(SET_MAIN_SERVICE);
        PendingIntent setPendingIntent = PendingIntent.getService(context, 0, setIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        // Open App
        PackageManager pm = context.getPackageManager();
        Intent intent = pm.getLaunchIntentForPackage("com.example.kanshi");
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(context, APP_IN_BACKGROUND_CHANNEL)
                .setContentTitle(title.equals("") ?"Kanshi.":title)
                .setSmallIcon(R.drawable.ic_stat_name)
                .setContentIntent(pendingIntent)
                .addAction(keepAppRunningInBackground? R.drawable.check_white : R.drawable.disabled_white, keepAppRunningInBackground ? "ENABLED" : "DISABLED", setPendingIntent)
                .addAction(R.drawable.stop_white, "EXIT", stopPendingIntent)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setSilent(true)
                .setShowWhen(false)
                .setNumber(0)
                .build();
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        notificationManager.notify(SERVICE_NOTIFICATION_ID, notification);
    }

    public void stopService() {
        if (
            shouldCallStopService
            && !isAddingAnimeReleaseNotification
            && AnimeNotificationManager.ongoingImageDownloads.size()==0
        ) {
            updateLastBackgroundUpdateTime();
            stopForeground(true);
            stopSelf();
        }
    }

    public void updateLastBackgroundUpdateTime() {
        if (lastBackgroundUpdateIsFinished) {
            MainActivity mainActivity = MainActivity.getInstanceActivity();
            if (mainActivity != null) {
                mainActivity.shouldRefreshList = shouldRefreshList;
                mainActivity.shouldProcessRecommendationList = shouldProcessRecommendationList;
                mainActivity.shouldLoadAnime = shouldLoadAnime;
            }
            if (!lastBackgroundUpdateTimeIsAlreadyUpdated) {
                lastBackgroundUpdateTimeIsAlreadyUpdated = true;
                long currentTime = System.currentTimeMillis();
                long backgroundUpdateTime = prefs.getLong("lastBackgroundUpdateTime", currentTime);
                if (backgroundUpdateTime <= currentTime) {
                    SharedPreferences.Editor prefsEdit = prefs.edit();
                    long ONE_HOUR_IN_MILLIS = TimeUnit.HOURS.toMillis(1);
                    backgroundUpdateTime = backgroundUpdateTime + ONE_HOUR_IN_MILLIS;
                    prefsEdit.putLong("lastBackgroundUpdateTime", backgroundUpdateTime).apply();
                }
            }
        }
    }

    public void finishedAddingAnimeReleaseNotification() {
        isAddingAnimeReleaseNotification = false;
        stopService();
    }

    @SuppressWarnings("unused")
    class JSBridge {
        BufferedWriter writer;
        File tempFile;
        String directoryPath;
        @JavascriptInterface
        public void pageIsFinished() {
            pageLoaded = true;
        }
        @JavascriptInterface
        public void visited() {
            prefsEdit.putBoolean("visited", true).apply();
        }
        boolean dataEvictionChannelIsAdded = false;
        @JavascriptInterface
        public void notifyDataEviction() {
            if (ActivityCompat.checkSelfPermission(MainService.this.getApplicationContext(), android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                final String DATA_EVICTION_CHANNEL = "data_eviction_channel";
                final int NOTIFICATION_DATA_EVICTION = 993;
                if (!dataEvictionChannelIsAdded) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        CharSequence name = "Data Eviction";
                        String description = "Notifications for data loss from chrome eviction.";
                        int importance = NotificationManager.IMPORTANCE_DEFAULT;
                        NotificationChannel channel = new NotificationChannel(DATA_EVICTION_CHANNEL, name, importance);
                        channel.setDescription(description);
                        channel.enableVibration(true);

                        NotificationManager notificationManager = MainService.this.getApplicationContext().getSystemService(NotificationManager.class);
                        notificationManager.createNotificationChannel(channel);
                    }
                    dataEvictionChannelIsAdded = true;
                }
                PackageManager pm = MainService.this.getApplicationContext().getPackageManager();
                Intent intent = pm.getLaunchIntentForPackage("com.example.kanshi");
                PendingIntent pendingIntent = PendingIntent.getActivity(MainService.this.getApplicationContext(), 0, intent, PendingIntent.FLAG_IMMUTABLE);
                pendingIntent.cancel();
                pendingIntent = PendingIntent.getActivity(MainService.this.getApplicationContext(), 0, intent, PendingIntent.FLAG_IMMUTABLE);
                NotificationCompat.Builder builder = new NotificationCompat.Builder(MainService.this.getApplicationContext(), DATA_EVICTION_CHANNEL)
                        .setSmallIcon(R.drawable.ic_stat_name)
                        .setContentTitle("Possible Data Loss!")
                        .setContentText("Some of your data may be cleared by chrome, please import your saved data.")
                        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                        .setContentIntent(pendingIntent);
                NotificationManagerCompat notificationManager = NotificationManagerCompat.from(MainService.this.getApplicationContext());
                notificationManager.cancel(NOTIFICATION_DATA_EVICTION);
                notificationManager.notify(NOTIFICATION_DATA_EVICTION, builder.build());
            }
            MainActivity mainActivity = MainActivity.getInstanceActivity();
            if (mainActivity != null) {
                mainActivity.reloadWeb();
                mainActivity.showDataEvictionDialog();
            }
        }
        @JavascriptInterface
        public void setShouldProcessRecommendation(boolean shouldProcess) {
            if (shouldProcess && !shouldRefreshList) {
                shouldLoadAnime = shouldProcessRecommendationList = shouldRefreshList = true;
                MainActivity mainActivity = MainActivity.getInstanceActivity();
                if (mainActivity != null) {
                    mainActivity.shouldRefreshList = shouldRefreshList;
                    mainActivity.shouldProcessRecommendationList = shouldProcessRecommendationList;
                    mainActivity.shouldLoadAnime = shouldLoadAnime;
                }
            } else {
                shouldProcessRecommendationList = shouldProcess;
                MainActivity mainActivity = MainActivity.getInstanceActivity();
                if (mainActivity != null) {
                    mainActivity.shouldProcessRecommendationList = shouldProcessRecommendationList;
                }
            }
        }
        @JavascriptInterface
        public void setShouldLoadAnime(boolean shouldLoad) {
            shouldLoadAnime = shouldLoad;
            MainActivity mainActivity = MainActivity.getInstanceActivity();
            if (mainActivity != null) {
                mainActivity.shouldLoadAnime = shouldLoadAnime;
            }
        }
        @JavascriptInterface
        public void backgroundUpdateIsFinished(boolean finished) {
            if (finished) {
                lastBackgroundUpdateIsFinished = true;
            }
            shouldCallStopService = true;
            stopService();
        }
        @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
        @JavascriptInterface
        public void sendBackgroundStatus(String text) {
            updateNotificationTitle(text);
        }
        @RequiresApi(api = Build.VERSION_CODES.R)
        @JavascriptInterface
        public void exportJSON(String chunk, int status, String fileName){
            if(status==0) {
                if (writer!=null) {
                    try {
                        writer.close();
                        writer = null;
                    } catch (Exception ignored) {}
                }
                if (Environment.isExternalStorageManager()) {
                    if (new File(exportPath).isDirectory()) {
                        directoryPath = exportPath + File.separator;
                        File directory = new File(directoryPath);
                        boolean dirIsCreated;
                        if (!directory.exists()) {
                            dirIsCreated = directory.mkdirs();
                        } else {
                            dirIsCreated = true;
                        }
                        if (directory.isDirectory() && dirIsCreated) {
                            try {
                                tempFile = new File(directoryPath + "pb.tmp.json");
                                boolean tempFileIsDeleted;
                                if (tempFile.exists()) {
                                    tempFileIsDeleted = tempFile.delete();
                                    //noinspection ResultOfMethodCallIgnored
                                    tempFile.createNewFile();
                                } else {
                                    tempFileIsDeleted = true;
                                    //noinspection ResultOfMethodCallIgnored
                                    tempFile.createNewFile();
                                }
                                if (tempFileIsDeleted) {
                                    writer = new BufferedWriter(new FileWriter(tempFile, true));
                                } else {
                                    if (writer!=null) {
                                        try {
                                            writer.close();
                                            writer = null;
                                        } catch (Exception ignored) {}
                                    }
                                    isExported(false);
                                }
                            } catch (Exception e) {
                                if(writer!=null){
                                    try {
                                        writer.close();
                                        writer = null;
                                    } catch (Exception e2) {
                                        e.printStackTrace();
                                    }
                                }
                                isExported(false);
                                e.printStackTrace();
                            }
                        }
                    }
                }
            } else if(status==1&&writer!=null) {
                try{
                    writer.write(chunk);
                } catch (Exception e) {
                    try {
                        writer.close();
                        writer = null;
                    } catch (Exception e2) {
                        e.printStackTrace();
                    }
                    isExported(false);
                    e.printStackTrace();
                }
            } else if(status==2&&writer!=null){
                try {
                    writer.write(chunk);
                    writer.close();
                    writer = null;
                    int lastStringLen = Math.min(chunk.length(), 3);
                    String lastNCharacters = new String(new char[lastStringLen]).replace("\0", "}");
                    if (chunk.endsWith(lastNCharacters)) {
                        boolean fileIsDeleted;
                        File file = new File(directoryPath + fileName);
                        if (file.exists()) {
                            fileIsDeleted = file.delete();
                            //noinspection ResultOfMethodCallIgnored
                            file.createNewFile();
                        } else {
                            //noinspection ResultOfMethodCallIgnored
                            file.createNewFile();
                            fileIsDeleted = true;
                        }
                        if (fileIsDeleted) {
                            if (tempFile != null && tempFile.exists()) {
                                if (tempFile.renameTo(file)) {
                                    isExported(true);
                                    File $tempFile = new File(directoryPath + "tmp.json");
                                    //noinspection ResultOfMethodCallIgnored
                                    $tempFile.delete();
                                } else {
                                    isExported(false);
                                    //noinspection ResultOfMethodCallIgnored
                                    file.delete();
                                    //noinspection ResultOfMethodCallIgnored
                                    tempFile.delete();
                                }
                            } else {
                                isExported(false);
                                //noinspection ResultOfMethodCallIgnored
                                file.delete();
                            }
                        } else {
                            isExported(false);
                        }
                    } else {
                        isExported(false);
                    }
                } catch (Exception e) {
                    try {
                        if (writer!=null) {
                            writer.close();
                            writer = null;
                        }
                    } catch (Exception e2) {
                        e.printStackTrace();
                    }
                    isExported(false);
                    e.printStackTrace();
                }
            }
        }
        @RequiresApi(api = Build.VERSION_CODES.N)
        @JavascriptInterface
        public void isOnline(boolean isOnline) {
            try {
                Handler handler = new Handler(Looper.getMainLooper());
                handler.post(() -> {
                    String url = webView.getUrl();
                    if (isOnline && (url==null || url.startsWith("file"))) {
                        appSwitched = true;
                        pageLoaded = false;
                        webView.loadUrl("https://u-kuro.github.io/Kanshi-Anime-Recommender/");
                    }
                });
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        final long DAY_IN_MILLIS = TimeUnit.DAYS.toMillis(1);
        @JavascriptInterface
        public void addAnimeReleaseNotification(long animeId, String title, long releaseEpisode, long maxEpisode, long releaseDateMillis, String imageUrl, boolean isMyAnime) {
            if (releaseDateMillis >= (System.currentTimeMillis() - DAY_IN_MILLIS)) {
                isAddingAnimeReleaseNotification = true;
                AnimeNotificationManager.scheduleAnimeNotification(MainService.this, animeId, title, releaseEpisode, maxEpisode, releaseDateMillis, imageUrl, isMyAnime);
            }
        }
        @JavascriptInterface
        public void callUpdateNotifications() {
            updateCurrentNotifications();
        }
        private final ExecutorService updateNotificationsExecutorService = Executors.newFixedThreadPool(1);
        private final Map<String, Future<?>> updateNotificationsFutures = new ConcurrentHashMap<>();
        @RequiresApi(api = Build.VERSION_CODES.O)
        @JavascriptInterface
        public void updateNotifications(long animeId, boolean isMyAnime) {
            if (updateNotificationsFutures.containsKey(String.valueOf(animeId))) {
                Future<?> future = updateNotificationsFutures.get(String.valueOf(animeId));
                if (future != null && !future.isDone()) {
                    future.cancel(true);
                }
            }
            Future<?> future = updateNotificationsExecutorService.submit(() -> {
                if (AnimeNotificationManager.allAnimeNotification.size()==0) {
                    try {
                        @SuppressWarnings("unchecked") ConcurrentHashMap<String, AnimeNotification> $allAnimeNotification = (ConcurrentHashMap<String, AnimeNotification>) LocalPersistence.readObjectFromFile(MainService.this, "allAnimeNotification");
                        if ($allAnimeNotification != null && $allAnimeNotification.size() > 0) {
                            AnimeNotificationManager.allAnimeNotification.putAll($allAnimeNotification);
                        }
                    } catch (Exception ignored) {}
                }
                ConcurrentHashMap<String, AnimeNotification> updatedAnimeNotifications = new ConcurrentHashMap<>();
                List<AnimeNotification> allAnimeNotificationValues = new ArrayList<>(AnimeNotificationManager.allAnimeNotification.values());
                for (AnimeNotification anime : allAnimeNotificationValues) {
                    if (anime.animeId==animeId) {
                        AnimeNotification newAnime = new AnimeNotification(anime.animeId, anime.title, anime.releaseEpisode, anime.maxEpisode, anime.releaseDateMillis, anime.imageByte, isMyAnime);
                        updatedAnimeNotifications.put(anime.animeId+"-"+anime.releaseEpisode, newAnime);
                    }
                }
                AnimeNotificationManager.allAnimeNotification.putAll(updatedAnimeNotifications);
                LocalPersistence.writeObjectToFile(MainService.this, AnimeNotificationManager.allAnimeNotification, "allAnimeNotification");
                updateNotificationsFutures.remove(String.valueOf(animeId));
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                    if (updateNotificationsFutures.isEmpty()) {
                        SchedulesTabFragment schedulesTabFragment = SchedulesTabFragment.getInstanceActivity();
                        if (schedulesTabFragment!=null) {
                            schedulesTabFragment.updateScheduledAnime();
                        }
                        ReleasedTabFragment releasedTabFragment = ReleasedTabFragment.getInstanceActivity();
                        if (releasedTabFragment!=null) {
                            releasedTabFragment.updateReleasedAnime();
                        }
                    }
                }
            });
            updateNotificationsFutures.put(String.valueOf(animeId), future);
        }
        @JavascriptInterface
        public void showNewUpdatedAnimeNotification(long addedAnimeCount, long updatedAnimeCount) {
            MainService.this.addedAnimeCount = addedAnimeCount;
            MainService.this.updatedAnimeCount = updatedAnimeCount;
        }
    }

    private final ExecutorService updateCurrentNotificationsExecutorService = Executors.newFixedThreadPool(1);
    private Future<String> updateCurrentNotificationsFuture;
    public void updateCurrentNotifications() {
        if (updateCurrentNotificationsFuture != null && !updateCurrentNotificationsFuture.isCancelled()) {
            updateCurrentNotificationsFuture.cancel(true);
        }
        updateCurrentNotificationsFuture = updateCurrentNotificationsExecutorService.submit(() -> {
            if (AnimeNotificationManager.allAnimeNotification.size()==0) {
                try {
                    @SuppressWarnings("unchecked") ConcurrentHashMap<String, AnimeNotification> $allAnimeNotification = (ConcurrentHashMap<String, AnimeNotification>) LocalPersistence.readObjectFromFile(MainService.this, "allAnimeNotification");
                    if ($allAnimeNotification != null && $allAnimeNotification.size() > 0) {
                        AnimeNotificationManager.allAnimeNotification.putAll($allAnimeNotification);
                    }
                } catch (Exception ignored) {}
            }
            Set<String> animeIdsToBeUpdated = new HashSet<>();
            List<AnimeNotification> allAnimeNotificationValues = new ArrayList<>(AnimeNotificationManager.allAnimeNotification.values());
            for (AnimeNotification anime : allAnimeNotificationValues) {
                animeIdsToBeUpdated.add(String.valueOf(anime.animeId));
            }
            return String.join(",", animeIdsToBeUpdated);
        });
        try {
            String joinedAnimeIds = updateCurrentNotificationsFuture.get();
            Handler handler = new Handler(Looper.getMainLooper());
            handler.post(() -> webView.loadUrl("javascript:window?.updateNotifications?.([" + joinedAnimeIds + "])"));
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            updateCurrentNotificationsExecutorService.shutdown();
        }
    }
    public void isExported(boolean success) {
        try {
            Handler handler = new Handler(Looper.getMainLooper());
            handler.post(() -> {
                if (success) {
                    webView.loadUrl("javascript:window?.isExported?.(true)");
                } else {
                    webView.loadUrl("javascript:window?.isExported?.(false)");
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
            MainService.this.stopForeground(true);
            MainService.this.stopSelf();
        }
    }
}
