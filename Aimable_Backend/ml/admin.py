from django.contrib import admin

from .models import ModelRun


@admin.register(ModelRun)
class ModelRunAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("name",)
