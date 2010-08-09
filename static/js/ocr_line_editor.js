// Editor for text on a single OCR transcript line


function OcrLineEditor(insertinto_id) {
    // the element we're operating on
    var m_elem = null;

    // selection start & end index
    var m_selectstart = -1;
    var m_selectend = -1;

    var m_proxycontainer = $("<div></div>")
        .attr("id", "proxy_container");
    var m_proxyeditor = $("<input></input>")
        .addClass("proxy_editor")
        .attr("type", "text")
        .attr("id", "proxy_editor")
        .css("width", "700px");

    // alias 'this'
    var self = this;


    this.setElement = function(element) {
        if (m_elem != null) {
            self.releaseElement();
        }
        m_elem = $(element);        
        self.grabElement();
    }

    this.init = function() {
        buildUi();
    }

    
    this.grabElement = function() {
        m_elem.addClass("selected");    
        m_elem.addClass("editing");
        m_elem.bind("click.lineedit", function(event) {
            m_elem.toggleClass("selected");    
        });
        m_elem.bind("keydown.lineedit", function(event) {
            alert("keydown");
        });
        m_proxyeditor.val(m_elem.text());
        m_proxyeditor.focus();
        m_proxyeditor.select();
        m_proxycontainer.show().css("top",
                (m_elem.offset().top - (2 * m_proxycontainer.height())) + "px");
    }    

    this.releaseElement = function(element) {
        m_elem.removeClass("selected");
        m_elem.removeClass("editing");
        m_elem.unbind("click.lineedit");
        m_elem.unbind("keydown.lineedit");
    }


    var buildUi = function() {
        $("#" + insertinto_id).append(m_proxycontainer.append(m_proxyeditor).hide());

    }
}
