// Make a span editable.  Second attempt

if (OCRJS === undefined) {
    var OCRJS = {};
}


OCRJS.LineEditor = Base.extend({

    _elem: null,          // the element we're operating on 
    _char: null,          // the current character in front of the cursor 
    _selectstart: null,   // selection start & end  
    _inittext: null,      // initial text of selected element 
    _keyevent: null,      // capture the last key event 
    _blinktimer: -1,      // timer for cursor flashing
    _dragpoint: null,     // the point dragging started 
    _undostack: new OCRJS.UndoStack(this), // undo stack object 
    _cursor: $("<div></div>") // cursor element
            .addClass("editcursor")
            .text("|"),
    _endmarker: $("<div></div>")  // anchor for the end of the line 
            .addClass("endmarker"),

                
            

});
