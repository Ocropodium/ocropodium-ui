// class for browsing and selecting files on the server

function FileBrowser(container_id) {
    var container = $("#" + container_id);
    var dir = "";
    var lsurl = "/filebrowser/ls";


    var self = this;

    this.init = function() {
        $.ajax({
            url: lsurl,
            dataType: "json",
            data: "dir=" + dir,
            beforeSend: function(e) { self.setWaiting(true); },
            complete: function(e) { self.setWaiting(false); },
            success: function(data) {
                drawFileList(data);
            },
            error: function(xhr, error) {
                alert(error);
            },
        });
    }


    this.setWaiting = function(wait) {
        container.toggleClass("waiting", wait);
    }


    var drawFileList = function(data) {
        var table = $("<table></table>")
            .addClass("filelist");
        
        $.each(data, function(i, file) {
            var row = $("<tr></tr>")
                .attr("id", "file" + i)
                .addClass("entry")
                .addClass(file[1]);

            var name = file[0];
            var size = file[2];
            var mtime = file[4];            
            row.append($("<td></td>").text(name));                
            row.append($("<td></td>").text(size));                
            row.append($("<td></td>").text(mtime));                
            table.append(row);
        });
        container.append(table);
    }    
}
