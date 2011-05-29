
import node
import manager
import stages
import numpy


class Rotate90Node(node.Node):
    """
    Rotate a Numpy image by num*90 degrees.
    """
    arity = 1
    stage = stages.FILTER_BINARY
    name = "Numpy::Rotate90"
    description = "Rotate image num*90 degrees counter-clockwise"
    _parameters = [{
        "name": "num",
        "value": 1,
    }]
                    
    def _validate(self):
        super(Rotate90Node, self)._validate()
        if not self._params.get("num"):
            raise node.ValidationError("%s: 'num' is not set" % self)
        try:
            num = int(self._params.get("num"))
        except TypeError:
            raise node.ValidationError("%s: 'num' must be an integer" % self)

    def _eval(self):
        image = self.get_input_data(0)
        return numpy.rot90(image, int(self._params.get("num", 1)))


class Rotate90GrayNode(Rotate90Node):
    """
    Grayscale version of above.
    """
    stage = stages.FILTER_GRAY
    name = "Numpy::Rotate90Gray"


class Manager(manager.StandardManager):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name.find("::") != -1:
            name = name.split("::")[-1]
        if name == "Rotate90":
            return Rotate90Node(**kwargs)
        elif name == "Rotate90Gray":
            return Rotate90Node(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())


if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n



