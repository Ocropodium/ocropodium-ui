

function MultiFilterList(name, states, includeall) {
    var self = this;
    this.ui = function() {
        var filterlist = $("<div></div>")
            .addClass("list_popup")
            .hide();
        var statetemp = $("<div></div>")
            .addClass("state_filter")
            .append(
                $("<label></label>")
                    .addClass("state_label")
                    .attr("for", "ALL")
                    .text("ALL"))
            .append(
                $("<input></input>")
                    .attr("type", "checkbox"));
        
        if (includeall) {
            var allfilter = statetemp
                .clone()
                .attr("checked", true)
                .appendTo(filterlist)
                .find("input")
                .attr("name", "ALL")
                .attr("class", "filter_none")
                .attr("checked", true)
                .click(function(event) {
                    if ($(this).attr("checked")) {
                        $(".filter_type").removeAttr("checked");
                    }
                    self.onChange();
                });
        }
            
        $.each(states, function(i, state) {
            var statbox = statetemp
                .clone()
                .find("label")
                .attr("for", state)
                .text(state)
                .end()
                .find("input")
                .attr("name", name + "_" + state)
                .addClass("filter_type")
                .click(function(event) {
                    if ($(this).attr("checked")) {
                        $(".filter_none:checked").removeAttr("checked");
                    } else {
                        $(".filter_none").attr("checked", $(".filter_type:checked").length == 0);
                    }
                    self.onChange();
                })
                .end()
                .appendTo(filterlist);
        });

        var filterbutton = $("<div></div>")
            .addClass("toggle_button")
            .text("Filter Tasks")
            .addClass("ui-state-default ui-corner-all")
            .hover(function(event) {
                $(this).addClass("ui-state-hover");
            }, function(event) {
                $(this).removeClass("ui-state-hover");
            })
            .toggle(function(event) {
                $(this).addClass("ui-state-active");
                filterlist.show();
            }, function(event) {
                $(this).removeClass("ui-state-active");
                filterlist.hide();
            });
        var container = $("<div></div>")
            .addClass("filter_container")
            .attr("id", name + "_filter")
            .append(filterbutton)
            .append(filterlist);

        return container;
    }

    this.value = function() {
        var vals = [];
        $("#" + name + "_filter").find(".filter_type").each(function(i, elem) {
            if ($(elem).attr("checked")) {
                vals.push($(elem).attr("name").replace(name + "_", ""));
            }
        });
        return vals;    
    }
}


MultiFilterList.prototype.onChange = function() {

}
