# -*- coding: utf-8 -*-
# Generated by Django 1.9 on 2016-07-11 23:25
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Video',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(blank=True, max_length=100)),
                ('annotation', models.TextField(blank=True)),
                ('source', models.CharField(blank=True, max_length=1048)),
                ('description', models.CharField(blank=True, max_length=1048)),
                ('url', models.CharField(blank=True, max_length=1048)),
            ],
        ),
    ]
