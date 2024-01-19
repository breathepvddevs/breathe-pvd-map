import pandas as pd
import os
from datetime import datetime
from pytz import timezone
import datetime
import urllib
import urllib.parse
import numpy as np 
import requests
import json
import pytz
import time
import sys



directory = './data'
file_name = 'sensors_with_nodes.csv'
file_path = os.path.join(directory, file_name)
sensors_df = pd.read_csv(file_path,usecols=["Sensor ID","Node ID","Location","Latitude","Longitude","Installation Date"])


sensors_df.to_json('./data/sensors_with_nodes.json',orient='records')
