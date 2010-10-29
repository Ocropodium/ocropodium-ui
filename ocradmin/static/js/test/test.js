
function Cat() {

    this.type = "Tabby";

    this.getType = function() {
        return this.type;
    }
}


function Lion() {
    this.type  = "Mountain";
}


Lion.prototype = new Cat();




