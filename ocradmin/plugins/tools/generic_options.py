
import os
import copy

import ocr_options
#reload(ocr_options_base)

import ocrolib

class GenericOptions(ocr_options.OcrOptions):
    """
    Generic options.
    """
    name = "generic"

    _ignored_components = ["StandardPreprocessing"]

    @classmethod
    def get_grayscale_filters(cls):
        """
        Ocropus grayscale filters.
        """
        return cls._get_components(
                    oftypes=["ICleanupGray"],
                    exclude=cls._ignored_components)

    @classmethod
    def get_binary_filters(cls):
        """
        Ocropus grayscale filters.
        """
        return cls._get_components(
                    oftypes=["ICleanupBinary"],
                    exclude=cls._ignored_components)

    @classmethod
    def get_page_segmenters(cls):
        """
        Ocropus grayscale filters.
        """
        return cls._get_components(
                    oftypes=["ISegmentPage"],
                    exclude=cls._ignored_components)

    @classmethod
    def get_binarizers(cls):
        """
        Ocropus binarizers.
        """
        return cls._get_components(
                    oftypes=["IBinarize"],
                    exclude=cls._ignored_components)

    @classmethod            
    def get_recognition_parameters(cls):
        """
        Generic recognition options.
        """
        return super(GenericOptions, cls).get_recognition_parameters()

    @classmethod
    def get_general_parameters(cls):
        """
        Generic misc options.
        """
        params = super(GenericOptions, cls).get_general_parameters()
        return params + [
            dict(
                name="debug",
                description="Dump debug info",
                multiple=False,
                value=True,
                type="bool",
            ),
        ]

    @classmethod
    def _get_components(cls, oftypes=None, withnames=None, exclude=None):
        """
        Get a datastructure contraining all Ocropus components
        (possibly of a given type) and their default parameters.
        """
        out = cls._get_native_components(oftypes, withnames, exclude=exclude)
        out.extend(cls._get_python_components(oftypes, withnames, exclude=exclude))
        return sorted(out, lambda x, y: cmp(x["name"], y["name"]))

    @classmethod
    def _get_native_components(cls, oftypes=None, withnames=None, exclude=None):
        """
        Get a datastructure contraining all Ocropus native components
        (possibly of a given type) and their default parameters.
        """
        out = []
        clist = ocrolib.ComponentList()
        for i in range(clist.length()):
            ckind = clist.kind(i)
            if oftypes and not \
                    ckind.lower() in [c.lower() for c in oftypes]:
                continue
            cname = clist.name(i)
            if withnames and not \
                    cname.lower() in [n.lower() for n in withnames]:
                continue
            if exclude and cname.lower() in [n.lower() for n in exclude]:
                continue
            compdict = dict(name=cname, type=ckind, parameters=[])
            # TODO: Fix this heavy-handed exception handling which is
            # liable to mask genuine errors - it's needed because of
            # various inconsistencies in the Python/native component
            # wrappers.
            try:
                comp = getattr(ocrolib, cname)()
                compdict = dict(
                    name=cname,
                    type="list",
                    description=comp.description(),
                    parameters=[])
            except (AttributeError, AssertionError, IndexError):
                continue
            for paramnum in range(0, comp.plength()):
                pname = comp.pname(paramnum)
                compdict["parameters"].append(dict(
                    name=pname,
                    type="scalar",
                    value=comp.pget(pname),
                    description="",
                    choices=None,
                ))
            out.append(compdict)
        return out

    @classmethod
    def _get_python_components(cls, oftypes=None, withnames=None, exclude=None):
        """
        Get native python components.
        """
        out = []
        directory = os.path.join(os.path.dirname(__file__), "components")
        for fname in os.listdir(directory):
            if not fname.endswith(".py"):
                continue
            modname = fname.replace(".py", "", 1)
            pmod = __import__("%s" % modname, fromlist=["main_class"])
            if not hasattr(pmod, "main_class"):
                continue
            ctype = pmod.main_class()
            ckind = ctype.__base__.__name__
            # note: the loading function in ocropy/components.py expects
            # python components to have a module-qualified name, i.e:
            # mymodule.MyComponent.
            cname = ctype.__name__
            if oftypes and not \
                    ckind.lower() in [c.lower() for c in oftypes]:
                continue
            if withnames and not \
                    cname.lower() in [n.lower() for n in withnames]:
                continue
            if exclude and cname.lower() in [n.lower() for n in exclude]:
                continue
            comp = ctype()
            # FIXME: Extreme dodginess getting the interface type,
            # very fragile
            compdict = dict(
                name=cname,
                type="list",
                parameters=[],
                description=comp.description()
            )
            for paramnum in range(0, comp.plength()):
                pname = comp.pname(paramnum)
                compdict["parameters"].append(dict(
                    name=pname,
                    description="",
                    type="scalar",
                    value=comp.pget(pname),
                    choices=None,
                ))
            out.append(compdict)
        return out



