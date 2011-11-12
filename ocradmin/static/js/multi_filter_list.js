

var MultiFilterList = Class.extend({
    init: function(name, states, includeall) {
        this.name = name;
        this.states = states;
        this.includeall = includeall;        
    },

    ui: function() {
        var self = this;
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
        
        if (self.includeall) {
            var allfilter = statetemp
                .clone()
                .prop("checked", true)
                .appendTo(filterlist)
                .find("input")
                .attr("name", "ALL")
                .attr("class", "filter_none")
                .prop("checked", true)
                .click(function(event) {
                    if ($(this).prop("checked")) {
                        $(".filter_type").prop("checked", false);
                    }
                    self.onChange();
                });
        }
            
        $.each(self.states, function(i, state) {
            var statbox = statetemp
                .clone()
                .find("label")
                .attr("for", state)
                .text(state)
                .end()
                .find("input")
                .attr("name", self.name + "_" + state)
                .addClass("filter_type")
                .click(function(event) {
                    if ($(this).prop("checked")) {
                        $(".filter_none:checked").prop("checked", false);
                    } else {
                        $(".filter_none").prop("checked", $(".filter_type:checked").length == 0);
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
            .attr("id", self.name + "_filter")
            .append(filterbutton)
            .append(filterlist);

        return container;
    },

    value: function() {
        var self = this;
        var vals = [];
        $("#" + self.name + "_filter").find(".filter_type").each(function(i, elem) {
            if ($(elem).prop("checked")) {
                vals.push($(elem).attr("name").replace(self.name + "_", ""));
            }
        });
        return vals;    
    },

    onChange: function() {

    },
});


