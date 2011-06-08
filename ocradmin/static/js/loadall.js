// ready() functions executed after everything else.
// Mainly for widget layout

$(function() {
    $(window).resize(function(event) {
     //   layoutWidgets();
    });
    //layoutWidgets();
    //$(window).trigger("resize");

    $("#workspace").invalidateLayout = function(event) {
      //  layoutWidgets();            
    }

    function deactivateMenu(menu) {
        $(menu).removeClass("selected")
            .unbind("click.menuclose")
            .find("ul").hide();
        $("div#menu ul.top").unbind("mouseenter.menuover");
        $(window).unbind("click.menuclose");        
        $(window).unbind("keydown.menuclose");        
        $(menu).bind("click.menuopen", function(event) {
            activateMenu(this);        
        });
    }

    function activateMenu(menu) {
        $("div#menu ul.top").not($(menu)).each(function(i, elem) {
            deactivateMenu(elem);
        }).bind("mouseenter.menuover", function(event) {
            activateMenu(this);
        });
        $(menu)
            .addClass("selected")
            .unbind("click.menuopen")
            .bind("click.menuclose", function(event) {
                deactivateMenu(menu);
            }).find("ul").show();
        $(window)
            .bind("keydown.menuclose", function(event) {
                if (event.keyCode == KC_ESCAPE) {
                    deactivateMenu(menu);
                    $("div#menu ul.top").unbind("click.menuclose");
                    $(window).unbind("keydown.menuclose");
                } else if (event.keyCode == KC_LEFT) {
                    if (menu.previousElementSibling) {
                        activateMenu(menu.previousElementSibling);
                    }
                } else if (event.keyCode == KC_RIGHT) {
                    if (menu.nextElementSibling) {
                        activateMenu(menu.nextElementSibling);
                    }
                } 
            }).bind("click.menuclose", function(event) {
                if (event.pageX > $(menu).offset().left &&
                    event.pageX < $(menu).offset().left +
                        $(menu).width() &&
                    event.pageY > $(menu).offset().top &&
                    event.pageY < $(menu).offset().top +
                        $(menu).height()) {
                    return true;
                }
                deactivateMenu(menu);            
            });
    }

    // active main menu click dropdown
    $("div#menu ul.top").bind("click.menuopen", function(e1) {
        activateMenu(this);
    });
});

