
import node
import manager
import numpy


class Rotate90Node(node.Node):
    """
    Rotate a Numpy image by num*90 degrees.
    """
    arity = 1

    def validate(self):
        super(RotateNode, self).validate()
        if not self._params.get("num"):
            raise node.UnsetParameterError("num")
        try:
            num = int(self._params.get("num"))
        except TypeError:
            raise node.InvalidParameterError("'num' must be an integer")

    def _eval(self):
        image = self.eval_input(0)
        return numpy.rot90(image, int(self._params.get("num", 1)))


class Manager(manager.StandardManager):
    """
    Handle Tesseract nodes.
    """
    @classmethod
    def get_node(self, name, **kwargs):
        if name == "NativeRecognizer":
            return TesseractRecognizerNode(**kwargs)

    @classmethod
    def get_nodes(cls, *oftypes):
        return super(Manager, cls).get_nodes(
                *oftypes, globals=globals())


if __name__ == "__main__":
    for n in Manager.get_nodes():
        print n



