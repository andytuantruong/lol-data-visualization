from flask import Flask
from .views.player_kills import app as dash_app

# Initialize the Flask app
flask_app = Flask(__name__)

# Integrate Dash app with Flask
dash_app.server = flask_app

@flask_app.route("/")
def home():
    return "Welcome to the League of Legends Analytics Platform!"