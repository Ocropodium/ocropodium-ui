/**
*
*  AJAX IFRAME METHOD (AIM)
*  http://www.webtoolkit.info/
*
**/
 
AIM = {
    frame : function(control) {
 
        var name = 'f' + Math.floor(Math.random() * 99999);
        var doc = document.createElement('DIV');
        doc.innerHTML = '<iframe style="display:none" src="about:blank" id="'
            +name+'" name="'+name+'" onload="AIM.loaded(\''+name+'\')"></iframe>';
        document.body.appendChild(doc);
 
        var frameele = document.getElementById(name);
        if (control && typeof(control.onComplete) == 'function') {
            frameele.onComplete = control.onComplete;
        }
 
        return name;
    },
 
    form : function(formele, name) {
        formele.setAttribute('target', name);
    },
 
    submit : function(formele, control) {
        AIM.form(formele, AIM.frame(control));
        if (control && typeof(control.onStart) == 'function') {
            return control.onStart();
        } else {
            return true;
        }
    },
 
    loaded : function(id) {
        var frameele = document.getElementById(id);
        if (frameele.contentDocument) {
            var doc = frameele.contentDocument;
        } else if (frameele.contentWindow) {
            var doc = frameele.contentWindow.document;
        } else {
            var doc = window.frames[id].document;
        }
        if (doc.location.href == "about:blank") {
            return;
        }
        if (typeof(frameele.onComplete) == 'function') {
            frameele.onComplete(doc.body.innerHTML);

        }
    }
}

