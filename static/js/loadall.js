// ready() functions executed after everything else.
// Mainly for widget layout

$(function() {
    $(window).resize(function(event) {
        layoutWidgets();
    });
    layoutWidgets();
    $(window).trigger("resize");

    $("#workspace").invalidateLayout = function(event) {
        layoutWidgets();            
    }

    function activeMenu() {

    }

    // active main menu click dropdown
    $("div#menu li h3").bind("click.menuopen", function(e1) {
        $(window).bind("keydown.closemenu", function(event) {
            if (event.keyCode == 27) 
                $("div#menu li h3").parent().removeClass("selected").children("ul").hide();
          
        });
        if (!$(this).parent().children("ul").length) 
            return true;
        $(this).parent().addClass("selected").children("ul").show();
        $("div#menu li h3").bind("mouseover.menumove", function(e2) {
            $("div#menu li h3").parent().removeClass("selected").children("ul").hide();
        });
        $("div#menu li h3").bind("mouseover.menushow", function(e3) {
            $(this).parent().addClass("selected").children("ul").show();
        });
        $("div#menu li.selected").add(this).bind("click.menuhide", function(e4) {
            $(this).removeClass("selected").children("ul").hide();
            $("div#menu li h3").unbind("mouseout.menumove");
            $("div#menu li h3").unbind("mouseover.menushow");
            $("div#menu li").unbind("click.menuhide");
        });
        return false;
    });
});

