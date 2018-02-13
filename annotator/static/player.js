"use strict";


class Player {
    constructor({$container, videoSrc, videoId, videoAnnotationId, videoStart, videoEnd, isImageSequence, turkMetadata}) {
       
        this.$container = $container;

        this.videoId = videoId;
        this.videoAnnotationId = videoAnnotationId;

        this.selectedAnnotation = null;

        this.annotations = null;

        this.annotationRectBindings = [];

        this.videoSrc = videoSrc;

        this.view = null;

        this.videoStart = videoStart;

        this.videoEnd = videoEnd;

        this.isImageSequence = isImageSequence;

        this.turkMetadata = turkMetadata;

        this.isImageSequence = isImageSequence;

        this.metrics = {
            playerStartTimes: Date.now(),
            annotationsStartTime: null,
            annotationsEndTime: null,
            browserAgent: navigator.userAgent
        };

        // Promises
        this.annotationsDataReady = Misc.CustomPromise();
        this.annotationsReady = Misc.CustomPromise();
        this.viewReady = Misc.CustomPromise();

        // We're ready when all the components are ready.
        this.ready = Misc.CustomPromiseAll(
            this.annotationsReady(),
            this.viewReady()
        );

        // Prevent adding new properties
        Misc.preventExtensions(this, Player);

        this.initAnnotations();
        this.initView();
        this.initHandlers();
    }


    // Init ALL the annotations!

    initView() {
        var {$container, videoSrc, videoStart, videoEnd} = this;
        
        this.view = new PlayerView({$container, videoSrc, videoStart, videoEnd});

        this.view.ready().then(this.viewReady.resolve);
    }

    initAnnotations() {
        
        
        DataSources.annotations.load(this.videoId, this.videoAnnotationId).then((annotations) => {
            this.annotations = annotations;
            this.annotationsDataReady.resolve();
        });
    
        // When this.annotations is loaded AND view is ready for drawing...
        Promise.all([this.annotationsDataReady(), this.viewReady()]).then(() => {
            for (let annotation of this.annotations) {
         	if (annotation.keyframes.length != 0) { 
                	let rect = this.view.addRect();
                	rect.fill = annotation.fill;
                	this.initBindAnnotationAndRect(annotation, rect);
                }
            }

            $(this).triggerHandler('change-onscreen-annotations');
            $(this).triggerHandler('change-keyframes');

            this.annotationsReady.resolve();
        });
    }

    addNewElement(select, new_elem, color) {
        var select1 = document.getElementById(select);

        var res = [];
        for (var i = 0; i < select1.getElementsByTagName('option').length; i++) {
            res.push(select1[i].value);
            if (select1[i].style.backgroundColor === color && select1[i].value == new_elem) {
                return false;
            }
        }

        var opt = document.createElement('option');
        opt.value = new_elem;
        opt.innerHTML = new_elem;
        opt.style.backgroundColor = color;
        select1.append(opt)

        return true
    }


    initBindAnnotationAndRect(annotation, rect) {
        // On PlayerView...
        this.annotationRectBindings.push({annotation, rect});


        // On Rect...

        $(rect).on('discrete-change', (e, bounds) => {
            annotation.updateKeyframe({
                time: this.view.video.currentTime,
                bounds: bounds,
            }, this.isImageSequence);
            $(this).triggerHandler('change-onscreen-annotations');
            $(this).triggerHandler('change-keyframes');
        });

        $(rect).on('select', () => {
            this.selectedAnnotation = annotation;
            $(this).triggerHandler('change-keyframes');
        });

        $(rect).on('drag-start', () => {
            this.view.video.pause();
        });

        $(rect).on('focus', () => {
            this.selectedAnnotation = annotation;
            document.getElementById("current_ann").value = annotation.type;

            $('#change-ann-btn').prop('disabled', false);
            $('#change-ann-text').html('');
            $(this).triggerHandler('change-onscreen-annotations');
            $(this).triggerHandler('change-keyframes');
        });


        // On Annotation...

        $(annotation).on('change delete', () => {
            rect.appear({singlekeyframe: annotation.keyframes.length === 1});
        });
        $(annotation).triggerHandler('change');

        $(annotation).on('delete', () => {
            $(annotation).off();
            $(rect).off();
            this.view.deleteRect(rect);
        });
    }

    initHandlers() {
        // Drawing annotations
        $(this).on('change-onscreen-annotations', () => {
            this.drawOnscreenAnnotations();
        });

        $(this).on('change-keyframes', () => {
            this.drawKeyframes();
        });


        // Submitting
        $('#submit-btn').click(this.submitAnnotations.bind(this));

        $('#btn-show-accept').click(this.showAcceptDialog.bind(this));
        $('#btn-show-reject').click(this.showRejectDialog.bind(this));
        $('#btn-show-email').click(this.showEmailDialog.bind(this));

        $('#accept-reject-btn').click(this.acceptRejectAnnotations.bind(this));

        $('#email-btn').click(this.emailWorker.bind(this));

        $('#change-ann-btn').click(this.changeAnnotations.bind(this));

        $('#add-link-btn').click(this.linkAnnotations.bind(this));

        $('#delete-link-btn').click(this.deleteLinkAnnotations.bind(this));

        $('#btn-deleteAnnotation').click(this.deleteFullAnnotation.bind(this));

        $('#delete-selected-btn').click(this.deleteSVO.bind(this));

        // On drawing changed
        this.viewReady().then(() => {
            $(this.view.creationRect).on('drag-start', () => {
                this.view.video.pause();
            });

            $(this.view.creationRect).on('focus', () => {
                this.selectedAnnotation = null;
                document.getElementById("current_ann").value = '';
                $(this).triggerHandler('change-onscreen-annotations');
                $(this).triggerHandler('change-keyframes');
            });

            this.view.video.onTimeUpdate(() => {
                $(this).triggerHandler('change-onscreen-annotations');
            });

            $(this.view).on('create-rect', (e, rect) => {
                for (let i = 0; i < this.annotations.length; i++) {
                    if (this.annotations[i].type == '') {
                        window.alert('Insert description for previous SVO')
                        this.view.deleteRect(rect);
                        return false;
                    }
                }
                this.addAnnotationAtCurrentTimeFromRect(rect);
                rect.focus();
                $(this).triggerHandler('change-keyframes');
            });

            $(this.view).on('add-fullannotation', () => {
                this.addFullAnnotation();
            });

            $(this.view).on('delete-keyframe', () => {
                this.view.video.pause();
                this.deleteSelectedKeyframe();
                $(this).triggerHandler('change-onscreen-annotations');
                $(this).triggerHandler('change-keyframes');
            });

            $(this.view).on('step-forward-keyframe', () => {
                var time = this.view.video.currentTime;
                if (!this.selectedAnnotation || !this.selectedAnnotation.keyframes)
                    return;
                for (let [i, kf] of this.selectedAnnotation.keyframes.entries()) {
                    if (Math.abs(time - kf.time) < this.selectedAnnotation.SAME_FRAME_THRESHOLD) {
                        if (i != this.selectedAnnotation.keyframes.length - 1) {
                            var nf = this.selectedAnnotation.keyframes[i + 1];
                            this.view.video.currentTime = nf.time;
                            break;
                        }
                    }
                }
            });

            $(this.view).on('step-backward-keyframe', () => {
                var time = this.view.video.currentTime;
                var selected = this.selectedAnnotation;
                if (!this.selectedAnnotation || !this.selectedAnnotation.keyframes)
                    return;
                for (let [i, kf] of this.selectedAnnotation.keyframes.entries()) {
                    if (Math.abs(time - kf.time) < this.selectedAnnotation.SAME_FRAME_THRESHOLD) {
                        if (i !== 0) {
                            var nf = this.selectedAnnotation.keyframes[i - 1];
                            this.view.video.currentTime = nf.time;
                            break;
                        }
                    }
                }
            });

            $(this.view).on('duplicate-keyframe', () => {
                var time = this.view.video.currentTime;

                if (!this.selectedAnnotation || !this.selectedAnnotation.keyframes) {
                    return;
                }
                var previousKeyFrame;
                for (let [i, kf] of this.selectedAnnotation.keyframes.entries()) {
                    if (Math.abs(kf.time - time) < this.selectedAnnotation.SAME_FRAME_THRESHOLD) {
                        return;
                    } else if (kf.time > time) {
                        break;
                    }
                    previousKeyFrame = kf;
                }
                this.selectedAnnotation.updateKeyframe({time:time, bounds:previousKeyFrame.bounds}, this.isImageSequence);
                $(this).triggerHandler('change-onscreen-annotations');
                $(this).triggerHandler('change-keyframes');
            });

        });
    }


    // Draw something

    drawOnscreenAnnotations() {
        for (let {annotation, rect} of this.annotationRectBindings) {
            this.drawAnnotationOnRect(annotation, rect);
        }
    }

    drawKeyframes() {
        this.view.keyframebar.resetWithDuration(this.view.video.duration);
        for (let annotation of this.annotations) {
            for (let keyframe of annotation.keyframes) {
                let selected = (annotation == this.selectedAnnotation);
                this.view.keyframebar.addKeyframeAt(keyframe.time, {selected});
            }
        }
    }

    drawAnnotationOnRect(annotation, rect) {
        if (this.metrics.annotationsStartTime == null) {
            this.metrics.annotationsStartTime = Date.now();
            // force the keyboard shortcuts to work within an iframe
            window.focus();
        }
        var time = this.view.video.currentTime;

        var {bounds, prevIndex, nextIndex, closestIndex, continueInterpolation} = annotation.getFrameAtTime(time, this.isImageSequence);

        // singlekeyframe determines whether we show or hide the object
        // we want to hide if:
        //   - the very first frame object is in the future (nextIndex == 0 && closestIndex is null)
        //   - we're after the last frame and that last frame was marked as continueInterpolation false
        rect.appear({
            real: closestIndex != null,
            selected: this.selectedAnnotation === annotation,
            singlekeyframe: continueInterpolation && !(nextIndex == 0 && closestIndex === null)
        });

        // Don't mess up our drag
        if (rect.isBeingDragged()) return;

        rect.bounds = bounds;
    }


    // Actions

    submitAnnotations(e) {
        e.preventDefault();
        this.metrics.annotationsEndTime = Date.now();
        if (this.metrics.annotationsStartTime == null) {
            this.metrics.annotationsStartTime = this.metrics.annotationsEndTime;
        }
        if (this.annotations.length === 0 && !confirm('Confirm that there are no objects in the video?')) {
            return;
        }
        for (let i = 0; i < this.annotations.length; i++) {
            if (this.annotations[i].type === '') {
                window.alert('You have an empty SVO. Fill in the description to continue.');
                return false;
            }
        }
        var desc = document.querySelector('textarea[name = "description"]').value;
        DataSources.annotations.save(desc, this.videoId, this.videoAnnotationId, this.annotations, this.metrics, window.mturk).then((response) => {
            // only show this if not running on turk
            if (!window.hitId)
                this.showModal("Save", response);
        });
    }

    deleteFullAnnotation(){
        var url
        var urlAux 
        url = window.location.href
        urlAux = '/deleteVideoAnnotation/' + this.videoId + '/' + this.videoAnnotationId + '/'
        url = url.replace(window.location.pathname, urlAux)
        window.location.replace(url)
    }

    showModal(title, message) {
        $('#genericModalTitle')[0].innerText = title;
        $('#genericModalMessage')[0].innerText = message;
        $('#genericModal').modal();
    }

    showAcceptDialog(e) {
        this.setDialogDefaults();
        if (this.turkMetadata) {
            $('#inputAcceptRejectMessage')[0].value = this.turkMetadata.bonusMessage
        }
        $('#acceptRejectType')[0].value = 'accept';
        $('#labelForBonus').text("Bonus")
        $('#inputBonusAmt').prop('readonly', false);
        $('#inputReopen')[0].checked = false;
        $('#inputDeleteBoxes')[0].checked = false;
        $('#inputBlockWorker')[0].checked = false;
        $('#accept-reject-btn').removeClass('btn-danger').addClass('btn-success')
        $('#accept-reject-btn').text('Accept');
        $('#acceptRejectForm').find('.modal-title').text("Accept Work");
        $('#acceptRejectForm').modal('toggle');
    }
    showRejectDialog(e) {
        this.setDialogDefaults();
        if (this.turkMetadata) {
            $('#inputAcceptRejectMessage')[0].value = this.turkMetadata.rejectionMessage;
        }
        $('#acceptRejectType')[0].value = 'reject';
        $('#labelForBonus').text("Lost Bonus")
        $('#inputBonusAmt').prop('readonly', true);
        $('#inputReopen')[0].checked = true;
        $('#inputDeleteBoxes')[0].checked = true;
        $('#inputBlockWorker')[0].checked = false;
        $('#accept-reject-btn').removeClass('btn-success').addClass('btn-danger')
        $('#accept-reject-btn').text('Reject');
        $('#acceptRejectForm').find('.modal-title').text("Reject Work");
        $('#acceptRejectForm').modal('toggle');
    }
    setDialogDefaults(){
        if (this.turkMetadata) {
            $('#inputBonusAmt')[0].value = this.turkMetadata.bonus
            $('.workerTime').text(this.verbaliseTimeTaken(this.turkMetadata.storedMetrics));
            $('.readonlyBrowser').text(this.turkMetadata.storedMetrics.browserAgent);
        }
        else {
            $('.turkSpecific').css({display:'none'});
        }
    }

    showEmailDialog(e) {
        this.setDialogDefaults();

        $('#inputEmailMessage')[0].value = this.turkMetadata.emailMessage;
        $('#inputEmailSubject')[0].value = this.turkMetadata.emailSubject;
        $('#emailForm').modal('toggle');
    }

    verbaliseTimeTaken(metricsObj) {
        var timeInMillis = metricsObj.annotationsEndTime - metricsObj.annotationsStartTime;

        return Math.round(timeInMillis / 60 / 100) / 10 + " minutes";
    }

    acceptRejectAnnotations(e) {
        e.preventDefault();
        var bonus = $('#inputBonusAmt')[0];
        var message = $('#inputAcceptRejectMessage')[0];
        var reopen = $('#inputReopen')[0];
        var deleteBoxes = $('#inputDeleteBoxes')[0];
        var blockWorker = $('#inputBlockWorker')[0]
        var type = $('#acceptRejectType')[0].value;

        $('#acceptRejectForm').find('.btn').attr("disabled", "disabled");

        var promise;
        if (type == 'accept')
            promise = DataSources.annotations.acceptAnnotation(this.videoId, parseFloat(bonus.value), message.value,
                                                               reopen.checked, deleteBoxes.checked, blockWorker.checked, this.annotations);
        else
            promise = DataSources.annotations.rejectAnnotation(this.videoId, message.value, reopen.checked, deleteBoxes.checked, blockWorker.checked, this.annotations);

        promise.then((response) => {
            $('#acceptForm').modal('toggle');
            $('#acceptForm').find('.btn').removeAttr("disabled");
            location.reload();
        }, (err) => {
            alert("There was an error processing your request.");
            $('#acceptForm').find('.btn').removeAttr("disabled");
        });
    }

    emailWorker(e) {
        e.preventDefault();
        var subject = $('#inputEmailSubject')[0];
        var message = $('#inputEmailMessage')[0];

        $('#emailForm').find('.btn').attr("disabled", "disabled");
        DataSources.annotations.emailWorker(this.videoId, subject.value, message.value).then((response) => {
            $('#emailForm').modal('toggle');
            $('#emailForm').find('.btn').removeAttr("disabled");
            location.reload();
        }, (err) => {
            alert("There was an error processing your request:\n" + err);
            $('#emailForm').find('.btn').removeAttr("disabled");
        });
    }

    addAnnotationAtCurrentTimeFromRect(rect) {
        var annotation = Annotation.newFromCreationRect(this.isImageSequence);
        annotation.updateKeyframe({
            time: this.view.video.currentTime,
            bounds: rect.bounds
        }, this.isImageSequence);
        this.annotations.push(annotation);
        rect.fill = annotation.fill;
        this.initBindAnnotationAndRect(annotation, rect);
    }

    addFullAnnotation() {
        var annotation = Annotation.createFullAnnotation();
        this.annotations.push(annotation)
    }

    removeOneEntryFromList(name1, color1, name2, color2) {
        var list = document.getElementById('link-annotation-list');
        var li = list.getElementsByTagName('li');

        var toRemove = []
        for (let i=0; i < li.length; i++) {
            if(li[i].innerHTML.indexOf(name1) > -1 && li[i].innerHTML.indexOf(name2) > -1) {
                toRemove.push(li[i]);
            }
        }

        for (let i = 0; i < toRemove.length; i++) {
            list.removeChild(toRemove[i]);
        }
    }

    removeFromList(name, color) {
        var list = document.getElementById('link-annotation-list');
        var li = list.getElementsByTagName('li');

        var toRemove = []
        for (let i=0; i < li.length; i++) {
            if(li[i].innerHTML.indexOf(name) > -1) {
                toRemove.push(li[i]);
            }
        }

        for (let i = 0; i < toRemove.length; i++) {
            list.removeChild(toRemove[i]);
        }
    }

    removeFromElem(select, name, color) {
        var select1 = document.getElementById(select);

        for (var i = 0; i < select1.getElementsByTagName('option').length; i++) {
            if (select1[i].value === name && this.rgbToHex(select1[i].style.backgroundColor) == color) {
                select1.removeChild(select1[i])
            }
        }
  
    }

    deleteSVO() {
        if (this.selectedAnnotation == null) {
            window.alert('No selected annotation');
            return false;
        }

        this.deleteAnnotation(this.selectedAnnotation);

        $(this).triggerHandler('change-onscreen-annotations');
        $(this).triggerHandler('change-keyframes');
    }

    deleteAnnotation(annotation) {
        if (annotation == null) return false;

        if (annotation == this.selectedAnnotation) {
            this.selectedAnnotation = null;
            document.getElementById("current_ann").value = '';
        }

        for (let i = 0; i < this.annotations.length; i++) {
            for (let k = 0; k < this.annotations[i].links.length; k++) {
                if (this.annotations[i].links[k].name === annotation.type &&
                        this.annotations[i].links[k].color === annotation.fill) {
                    this.annotations[i].links.splice(k, 1);
                }
            }
        }

        this.removeFromElem('annot1', annotation.type, annotation.fill)
        this.removeFromElem('annot2', annotation.type, annotation.fill)

        this.removeFromList(annotation.type, annotation.fill);

        for (let i = 0; i < this.annotations.length; i++) {
            if (this.annotations[i] === annotation) {
                annotation.delete();
                this.annotations.splice(i, 1);
                this.annotationRectBindings.splice(i, 1);
                return true;
            }
        }

        throw new Error("Player.deleteAnnotation: annotation not found");
    }

    changeElement(select, old_val, new_elem, color) {
        var select1 = document.getElementById(select);

        console.log(color)
        for (var i = 0; i < select1.getElementsByTagName('option').length; i++) {
            console.log(select1[i])
            if (select1[i].value === old_val && this.rgbToHex(select1[i].style.backgroundColor) == color) {
                select1[i].value = new_elem;
                select1[i].innerHTML = new_elem;
            }
        }
    }

    changeList(old_val, new_val) {
        var ul = document.getElementById("link-annotation-list");
        var vals = ul.getElementsByTagName('li')
        for (var i = 0; i < vals.length; i++) {
            vals[i].innerHTML = vals[i].innerHTML.replace(old_val, new_val)
        }
    }

    changeAnnotations(e) {
        e.preventDefault();
        if(this.selectedAnnotation) {
            var newSVO = document.getElementById("current_ann").value;
            if(newSVO != '' && newSVO != 'null') {
                if(newSVO === this.selectedAnnotation.type)
                $('#change-ann-text').html('Same SVO');
                else {
                    // change links
                    if (this.selectedAnnotation.type != '') {
                        this.changeElement("annot1", this.selectedAnnotation.type, newSVO, this.selectedAnnotation.fill);
                        this.changeElement("annot2", this.selectedAnnotation.type, newSVO, this.selectedAnnotation.fill);
                        this.changeList(this.selectedAnnotation.type, newSVO);
                        for (let i = 0; i < this.annotations.length; i++) {
                            for (let l = 0; l < this.annotations[i].links.length; l++) {
                                if (this.annotations[i].links[l].name === this.selectedAnnotation.type && 
                                        this.annotations[i].links[l].color == this.selectedAnnotation.fill) {
                                    this.annotations[i].links[l].name = newSVO
                                }
                            }
                        }
                    }

                    var old_val = this.selectedAnnotation.type;
                    this.selectedAnnotation.type = newSVO;
                    for (let i = 0; i < this.annotations.length; i++) {
                        if (this.annotations[i] === this.selectedAnnotation) {
                            this.annotations[i].type = newSVO;
                            $('#change-ann-text').html('Success!');

                            if (old_val === '') {
                                this.addNewElement('annot1', this.selectedAnnotation.type, this.selectedAnnotation.fill)
                                this.addNewElement('annot2', this.selectedAnnotation.type, this.selectedAnnotation.fill)
                            }
                            break;
                        }
                    }
                }
            }
            else 
            {
                $('#change-ann-text').html('Empty string!');
            }
        }
        else {
            $('#change-ann-text').html('No selected box!');
        }
    }

	rgbToHex(col) {
		if(col.charAt(0)=='r')
		{
			col=col.replace('rgb(','').replace(')','').split(',');
			var r=parseInt(col[0], 10).toString(16);
			var g=parseInt(col[1], 10).toString(16);
			var b=parseInt(col[2], 10).toString(16);
			r=r.length==1?'0'+r:r; g=g.length==1?'0'+g:g; b=b.length==1?'0'+b:b;
			var colHex='#'+r+g+b;
			return colHex;
		}
        return col;
	}

    deleteLinkAnnotations(e) {
        var select1 = document.getElementById("annot1").getElementsByTagName('option');
        var select2 = document.getElementById("annot2").getElementsByTagName('option');

        var annot1_name = '';
        var color1;
        for (var i = 0; i < select1.length; i++) {
            if (select1[i].selected) {
                annot1_name = select1[i].value;
                color1 = this.rgbToHex(select1[i].style.backgroundColor);
            }
        }

        var annot2_name = '';
        var color2;
        for (var i = 0; i < select2.length; i++) {
            if (select2[i].selected) {
                annot2_name = select2[i].value;
                color2 = this.rgbToHex(select2[i].style.backgroundColor);
            }
        }

        if (annot1_name === annot2_name && color1 === color2) {
            window.alert('The link does not exist');
            return false;
        }

        var ul = document.getElementById("link-annotation-list");

        for (var i = 0; i < this.annotations.length; i++) {
            var ok = true
            if ((this.annotations[i].type == annot1_name && this.annotations[i].fill == color1)
            || (this.annotations[i].type == annot2_name && this.annotations[i].fill == color2)) {
                ok = this.annotations[i].removeLink(color1, annot1_name);
                ok = this.annotations[i].removeLink(color2, annot2_name);

                this.removeOneEntryFromList(annot1_name, color1, annot2_name, color2)
            }
        }
 
    }


    linkAnnotations(e) {
        var select1 = document.getElementById("annot1").getElementsByTagName('option');
        var select2 = document.getElementById("annot2").getElementsByTagName('option');

        var annot1_name = '';
        var color1;
        for (var i = 0; i < select1.length; i++) {
            if (select1[i].selected) {
                annot1_name = select1[i].value;
                color1 = this.rgbToHex(select1[i].style.backgroundColor);
            }
        }

        var annot2_name = '';
        var color2;
        for (var i = 0; i < select2.length; i++) {
            if (select2[i].selected) {
                annot2_name = select2[i].value;
                color2 = this.rgbToHex(select2[i].style.backgroundColor);
            }
        }
 
        if (annot1_name === annot2_name && color1 === color2) {
            window.alert('Cannot add link between same annotation');
            return false;
        }

        var ul = document.getElementById("link-annotation-list");

        for (var i = 0; i < this.annotations.length; i++) {
            var ok = true
            if (this.annotations[i].type == annot1_name && this.annotations[i].fill == color1) {
                ok = this.annotations[i].addLink(color2, annot2_name);
                if (ok === false) {
                    window.alert('Link already exists')
                    continue;
                }
                var li = document.createElement("li");
                li.appendChild(document.createTextNode("('".concat(annot1_name, "', '", annot2_name, "')")));
                ul.appendChild(li);
            }
            if (this.annotations[i].type == annot2_name && this.annotations[i].fill == color2) {
                this.annotations[i].addLink(color1, annot1_name);
            }
        }
    }

    deleteSelectedKeyframe() {
        if (this.selectedAnnotation == null) return false;
        var selected = this.selectedAnnotation;
        this.selectedAnnotation = null;
        document.getElementById("current_ann").value = '';
        selected.deleteKeyframeAtTime(this.view.video.currentTime, this.isImageSequence);

        if (selected.keyframes.length === 0) {
            this.deleteAnnotation(selected);
        }

        return true;
    }

}

void Player;
