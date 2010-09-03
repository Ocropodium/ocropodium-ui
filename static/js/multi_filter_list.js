

function MultiFilterList(name, states, includeall) {
    var self = this;
    this.ui = function() {
        var statuses = ["INIT", "PENDING", "RETRY", "STARTED", "SUCCESS", "ERROR", "ABORTED"]; 
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
}


MultiFilterList.prototype.onChange = function() {

}
