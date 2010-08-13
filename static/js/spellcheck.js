// Spell checker widget.  Pops up a dialog allowing you to choose 
// a replacement word for any text in a given element

function Spellchecker(selector) {

    var m_data = null;
    var m_selector = selector;

    var self = this;

    
    /*
     *  Events...
     */

    $(".badspell").live("mouseenter mouseleave", function(event) {
        if (event.type == "mouseover") {
            showSuggestionWindow($(this));
        } else {
            closeSuggestionWindow();
        }
    })

    $(".suggestion").live("mouseover mouseout", function(event) {
        if (event.type == "mouseover") {
            $(this).addClass("hover");    
        } else {
            $(this).removeClass("hover");
        }
    });

    $(".suggestion").live("click", function(event) {
        var replace = $(this).text();
        $("#suggestion_list").parent().replaceWith(replace);
        closeSuggestionWindow();        
    });


    var closeSuggestionWindow = function() {
        $("#suggestion_list").remove();
        $(window).unbind("click.spellcheck");
        $(window).unbind("keyup.escapeclose");
    }


    var showSuggestionWindow = function(elem) {
        var word = elem.text();
        var suggestions = m_data[word].suggestions;
        if (suggestions == null)
            suggestions = ["No Suggestions"];

        var sugwindow = $("<div></div>")
            .attr("id", "suggestion_list")
            .addClass("widget")
            .addClass("suggestion_window");
        var suglist = $("<ul></ul>");
        $.each(suggestions, function(i, word) {
            suglist.append($("<li></li>")
                .addClass("suggestion")
                .text(word)
            );
        });
        sugwindow.append(suglist)
            .css("top", elem.position().top)
            .css("left", elem.position().left)
            .css("margin-top", elem.height() + "px")
            .appendTo(elem);

        $(window).bind("click.spellcheck", function(event) {
            closeSuggestionWindow();
        });
        $(window).bind("keyup.escapeclose", function(event) {
            if (event.keyCode == 27) {
                closeSuggestionWindow();
            }
        });
    }

    this.spellCheck = function() {
        var txt = $.map($(m_selector), function(c) {
            return $(c).text();
        }).join("\n");

        $.ajax({
            url: "/batch/spellcheck",
            type: "POST",
            data: {text: txt},
            dataType: "json",
            error: function(e) {
                alert("Spellcheck failed.  Unable to reach server: " + e);
            },
            success: function(data) {
                m_data = data;
                highlightWords();
            }
        });
    }


    var highlightWords = function() {
        $(m_selector).each(function(i, elem) {
            var html = $.map($(elem).html().split(/\b/), function(word) {
                if (m_data[word]) {
                    return "<span class='badspell'>" + word + "</span>";
                } else {
                    return word;
                }        
            }).join("");
            $(elem).html(html);
        });    
    }
}
