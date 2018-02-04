"use strict";


$(() => {
    // Some sanity checks that can't be used

    // Firefox doesn't allow this
    // Misc.preventExtensions(document);

    // Chrome extensions rely on window being extensible
    // Misc.preventExtensions(window);
    
    // Make the player
    window.p = new PlayerVideoAnnotations({
        $container: $("#playerVideoAnnotations"),
        videoSrc: window.video.location,
        videoId: window.video.id,
        videoStart: window.video.start_time,
        videoEnd: window.video.end_time
    });
});
