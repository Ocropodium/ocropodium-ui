// Editor for text on a single OCR transcript line


function OcrLineEditor(insertinto_id) {
    // the element we're operating on
    var m_elem = null;

    // useful key codes
    var ESCAPE = 27;
    var RETURN = 13;

    // selection start & end index
    var m_selectstart = -1;
    var m_selectend = -1;

    // initial text of selected element
    var m_inittext = null;

    var m_proxycontainer = $("<div></div>")
        .attr("id", "proxy_container");
    var m_proxyeditor = $("<input></input>")
        .addClass("proxy_editor")
        .attr("type", "text")
        .attr("id", "proxy_editor")
        .width(500);

    // alias 'this'
    var self = this;


    this.setElement = function(element) {
        if (m_elem != null) {
            self.releaseElement();
        }
        m_elem = $(element);
        m_inittext = m_elem.text();        
        self.grabElement();
    }

    this.element = function() {
        return m_elem;
    }

    this.init = function() {
        buildUi();
    }

    this.updateSelection = function() {
        var sel = document.getSelection();
        var srange = sel.getRangeAt(0);
        //var drange = m_proxyeditor.get(0).createTextRange();
        //drange.collapse(true);
        //drange.moveEnd(srange.endOffset);
        //drange.moveStart(srange.startOffset);
        m_proxyeditor.get(0).setSelectionRange(srange.startOffset, srange.endOffset);

    }

    this.show = function() {
        m_proxycontainer.show();
    }

    this.hide = function() {
        m_proxycontainer.hide();
    }
    
    this.grabElement = function() {
        m_elem.addClass("selected");    
        m_elem.addClass("editing");
        //m_elem.bind("click.lineedit", function(event) {
        //    m_elem.toggleClass("selected");    
        //});
        m_elem.bind("mouseup.textsel", function(event) {
            var sel = document.getSelection();
            
        });
        m_proxyeditor.val(m_elem.text());
        m_proxyeditor.focus();
        m_proxyeditor.select();
        m_proxycontainer.css("margin-top", "0px").css("position", "absolute")
            .css("top", "20px").css("left", "20px").width(500);
        //m_proxycontainer.show().css("top",
        //        (m_elem.offset().top - (2 * m_proxycontainer.height())) + "px");
    }    

    this.releaseElement = function() {
        m_elem.removeClass("selected");
        m_elem.removeClass("editing");
        m_elem.unbind("click.lineedit");
        m_elem.unbind("keydown.lineedit");
        m_elem.unbind("mouseup.textsel");
    }

    m_proxyeditor.bind("keydown keyup", function(event) {
        m_elem.text(m_proxyeditor.val());
        if (event.which == ESCAPE) { 
            m_elem.text(m_inittext);
            m_proxyeditor.trigger("blur");
            self.hide();            
        } else if (event.which == RETURN) {
            m_proxyeditor.trigger("blur");
            self.hide();
        }
    });

    var buildUi = function() {
        $("#" + insertinto_id).append(m_proxycontainer.append(m_proxyeditor).hide());

    }
}
