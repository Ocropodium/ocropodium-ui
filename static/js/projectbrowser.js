// Browser for opening projects
function validateProjectForm(scope) {
    var bad = $.trim($("#id_name", scope).val()) == "";
    $("#submit_new_project_form", scope).attr("disabled", bad);
}



// global opener hook
$(function() {
    $("#open_project").click(function(event) {
        var p = new ProjectBrowser();
        p.init();
        event.preventDefault();
    });

    $("#new_project").click(function(event) {
        var dialog = $("<div></div>")
            .attr("id", "dialog")
            .css("width", "700px")
            .css("height", "500px")
            .dialog({
                width: 700,
                height: 500,
                title: "New Project...",
                close: function() {
                    $(this).remove();
                },
                modal: true,
            }).load("/projects/new/", function() {
                $("#id_name").live("keyup", function(event) {
                    validateProjectForm(dialog);
                });
            });
        event.preventDefault();
    });
});


function ProjectBrowser() {

    var self = this,
        m_container = $("<div></div>")
            .attr("id", "project_container"),
        m_scrollcontainer = $("<div></div>")
            .attr("id", "scroll_container"),
        m_cancelbutton = $("<input></input>")
            .attr("type", "button")
            .attr("id", "cancel_button")
            .val("Cancel"),
        m_openbutton = $("<input></input>")
            .attr("type", "button")
            .attr("id", "open_button")
            .attr("disabled", true)
            .val("Open Project");


    /* 
     *  Events
     */

    $(".project_item").live("click.item", function(event) {
        $(this)
            .addClass("selected")
            .siblings().removeClass("selected");
        updateButtons();
    });

    $(".project_item").live("dblclick.item", function(event) {
        $(this).click();
        m_openbutton.click();
    });

    $(window).bind("keydown.projnav", function(event) {
        if (event.keyCode == KC_DOWN || event.keyCode == KC_UP) {
            var traverser = event.keyCode == KC_DOWN ? "next" : "prev";
            var endpoint =  event.keyCode == KC_DOWN ? "first" : "last"; 
            if (!$(".project_item.selected").length) {
                $(".project_item")[endpoint]().addClass("selected");        
            } else {
                var next = $(".project_item.selected")[traverser]();
                if (next.length) {
                    $(".project_item.selected").removeClass("selected");
                    next.addClass("selected");    
                }
            }
            updateButtons();
        } else if (event.keyCode == KC_ESCAPE) {
            self.close();
        }
    });

    var unbindEvents = function() {
        $(window).unbind("keydown.projnav");
    }

    m_cancelbutton.click(function(event) {            
        self.close();
    });

    m_openbutton.click(function(event) {
        var pk = $(".project_item.selected").data("pk");
        window.location.pathname = "/projects/load/" + pk + "/";
        self.close();
    });


    this.params = function() {
        return {};
    }

    this.init = function() {
        m_container.append(m_scrollcontainer);
        m_scrollcontainer.addClass("waiting");

        var buttonbox = $("<div></div>")
            .addClass("button_box");
        m_container.append(
            buttonbox.append(m_openbutton).append(m_cancelbutton)
        );

        m_container.appendTo($("body")).dialog({
            title: "Open Project",
            modal: true,
            width: 600,
            close: function(event) {
                self.close();
            },
        });

        $.ajax({
            url: "/projects/open",
            data: self.params(),
            dataType: "json",
            error: function(xhr, msg) { 
                alert("Error loading projects: " + msg);
            },
            success: function(data) {
                m_scrollcontainer.html("");
                var telem = $("<div></div>")
                    .addClass("project_item");
                $.each(data, function(i, project) {
                    m_scrollcontainer.append(
                        telem.clone()
                            .data("pk", project.pk)
                            .text(project.fields.name)
                            .attr("title", project.fields.description)
                    );    
                });
                $(".project_item").each(function(i, elem) {
                    if (i % 2 != 0)
                        $(elem).addClass("odd");
                });
            },
            complete: function(xhr) {
                m_scrollcontainer.removeClass("waiting");
            },
        });        
    }


    this.close = function() {
        unbindEvents();
        m_container.remove();    
    }


    var updateButtons = function() {
        m_openbutton.attr("disabled", $(".project_item.selected").length != 1)
            .focus();
    }


}
