"use strict";


class PlayerVideoAnnotations{
	constructor({$container, videoSrc, videoId, videoStart, videoEnd}){
		this.$container = $container;
		this.videoId = videoId;
		this.videoSrc = videoSrc;
		
		this.videoStart = videoStart;
		this.videoEnd = videoEnd;

		this.view = null;
		//console.log('arrives here 1')
		// Promises
		this.viewReady = Misc.CustomPromise();
		//console.log('arrives here 2')
		// We're ready when all the components are ready.
        this.ready = Misc.CustomPromiseAll(
            this.viewReady()
        );
        // Prevent adding new properties
        Misc.preventExtensions(this, PlayerVideoAnnotations);
        
		this.initView();
		this.initHandlers();
	}

	initView(){
		var {$container, videoSrc, videoStart, videoEnd}= this;
		//console.log('initView')
		this.view = new PlayerView({$container, videoSrc, videoStart, videoEnd});

		this.view.ready().then(this.viewReady.resolve);
	}

	initHandlers() {
		$('#addNewAnnotationButton').click(this.addNewAnnotationButtonFunction.bind(this));
	}

	addNewAnnotationButtonFunction(){
		var url
		var urlAux 
		url = window.location.href
		urlAux = '/createVideoAnnotation/' + this.videoId + '/'
		url = url.replace(window.location.pathname, urlAux)
		window.location.replace(url)
	}
}

void PlayerVideoAnnotations;