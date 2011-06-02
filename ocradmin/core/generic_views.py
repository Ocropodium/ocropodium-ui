"""
Generic base classes for template handling.  These prevent having to
write lots of boring code but it's necessary to read the docs to
understand it:

 https://docs.djangoproject.com/en/1.3/topics/class-based-views/
 https://docs.djangoproject.com/en/1.3/ref/class-based-views/

"""

from django import http
from django.views import generic
from django.core import serializers
from django.core.serializers.json import DjangoJSONEncoder

class JSONResponseMixin(object):
    def render_to_response(self, context):
        "Returns a JSON response containing 'context' as payload"
        return self.get_json_response(self.convert_context_to_json(context))

    def get_json_response(self, content, **httpresponse_kwargs):
        "Construct an `HttpResponse` object."
        return http.HttpResponse(content,
                                 content_type='application/json',
                                 **httpresponse_kwargs)

    def convert_context_to_json(self, context):
        "Convert the context dictionary into a JSON object"

        objects = context.get("object_list")
        if objects is None and context.get("object"):
            objects = [context.get("object")]
        elif objects is None:
            objects = context
        return serializers.serialize("json", objects)


class HybridListView(JSONResponseMixin, generic.list.MultipleObjectTemplateResponseMixin,
        generic.list.BaseListView):
    def render_to_response(self, context):
        # Look for a 'format=json' GET argument
        if self.request.GET.get('format','html') == 'json':
            return JSONResponseMixin.render_to_response(self, context)
        else:
            return generic.list.\
                    MultipleObjectTemplateResponseMixin\
                        .render_to_response(self, context)


class HybridDetailView(JSONResponseMixin, generic.detail.SingleObjectTemplateResponseMixin):
    def render_to_response(self, context):
        # Look for a 'format=json' GET argument
        if self.request.GET.get('format','html') == 'json':
            return JSONResponseMixin.render_to_response(self, context)
        else:
            return generic.detail.\
                    SingleObjectTemplateResponseMixin\
                        .render_to_response(self, context)


class GenericListView(HybridListView):
    """
    Generic detail view class.  Subclasses must supply
    both 'model' and 'fields'.
    """
    paginate_by = 20
    page_name = "Objects"
    fields = ["id"]

    def get_queryset(self):        
        order = self.request.GET.get("order", self.fields[0])
        return self.model.objects.all().order_by(order)    

    def get_template_names(self):
        names = [self.template_name] if self.template_name is not None \
                else []
        names.append("generic_list.html" if not self.request.is_ajax() \
                else "includes/generic_list_body.html")
        return tuple(names)                

    def get_context_data(self, **kwargs):
        context = super(GenericListView, self).get_context_data(**kwargs)
        context.update(
            page_name=self.page_name,
            fields=self.fields,
            model=self.model,
            order=self.request.GET.get("order", self.fields[0])
        )
        return context


class GenericDetailView(HybridDetailView, generic.detail.BaseDetailView):    
    """
    Generic detail view class.  Subclasses must supply
    both 'model' and 'fields'.
    """
    page_name="Object Details"
    fields=["id"]

    def get_template_names(self):
        names = [self.template_name] if self.template_name is not None \
                else []
        names.append("generic_detail.html" if not self.request.is_ajax() \
                else "includes/generic_detail_body.html")
        return tuple(names)                

    def get_context_data(self, **kwargs):
        context = super(GenericDetailView, self).get_context_data(**kwargs)
        context.update(page_name=self.page_name, fields=self.fields)
        return context


class GenericCreateView(generic.CreateView):
    """
    Generic create view class.  Subclasses must supply
    both 'model' and 'form_class'.
    """
    page_name="New Object"
    enctype = "application/x-www-form-urlencoded"

    def get_template_names(self):
        names = [self.template_name] if self.template_name is not None \
                else []
        names.append("generic_create.html" if not self.request.is_ajax() \
                else "includes/generic_create_body.html")
        return tuple(names)                

    def get_initial(self, *args, **kwargs):
        initial = super(GenericCreateView, self).get_initial(*args, **kwargs)
        initial.update(user=self.request.user)
        return initial

    def get_form_kwargs(self, *args, **kwargs):
        form_kwargs = super(GenericCreateView, self).get_form_kwargs(*args, **kwargs)
        return form_kwargs

    def get_context_data(self, **kwargs):
        context = super(GenericCreateView, self).get_context_data(**kwargs)
        context.update(page_name=self.page_name, model=self.model, 
                enctype=self.enctype)
        return context


class GenericEditView(generic.UpdateView):
    """
    Generic edit view class.  Subclasses must supply
    both 'model' and 'form_class'.
    """
    page_name="Edit Object"
    enctype = "application/x-www-form-urlencoded"

    def get_template_names(self):
        names = [self.template_name] if self.template_name is not None \
                else []
        names.append("generic_edit.html" if not self.request.is_ajax() \
                else "includes/generic_edit_body.html")
        return tuple(names)                

    def get_initial(self, *args, **kwargs):
        initial = super(GenericEditView, self).get_initial(*args, **kwargs)
        initial.update(user=self.request.user)
        return initial

    def get_context_data(self, **kwargs):
        context = super(GenericEditView, self).get_context_data(**kwargs)
        context.update(page_name=self.page_name, model=self.model, 
                enctype=self.enctype)
        return context


class GenericDeleteView(generic.DeleteView):
    """
    Generic delete view class.  Subclasses must supply
    both 'model' and 'success_url'.
    """
    page_name="Delete Object"

    def get_template_names(self):
        names = [self.template_name] if self.template_name is not None \
                else []
        names.append("generic_delete.html" if not self.request.is_ajax() \
                else "includes/generic_delete_body.html")
        return tuple(names)                

    def get_context_data(self, **kwargs):
        context = super(GenericDeleteView, self).get_context_data(**kwargs)
        context.update(page_name=self.page_name)
        return context



