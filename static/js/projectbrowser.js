// Browser for opening projects

// global opener hook
$(function() {
    $("#open_project").click(function(event) {
        var p = new ProjectBrowser();
        p.init();
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


    const ENTER = 13;
    const ESCAPE = 27;
    const UP = 38;
    const DOWN = 40;

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
        m_container.remove();    
    }


    var updateButtons = function() {
        m_openbutton.attr("disabled", $(".project_item.selected").length != 1);
    }


}
