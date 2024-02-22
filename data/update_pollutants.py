

### ADDING THE DATA IN THE SAME FILE 

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
import io

################# 


# pollutant = str(sys.argv[1])
pollutant = "co2"



### Global variable for failed requests
FAILED_REQUESTS = {"node_id":[], "location":[], "time":[]}



###PRE-CODING READING

def generate_url(node_name, node_id, variable, start_date, start_time, end_date, end_time):
    """Given a node_id, measure, start date and end date return the raw cvs files for that node """

    base_url = "http://128.32.208.8"


    custom_url = ("/node/" + str(node_id)
                  + "/measurements_all/csv?name=" + str(node_name) + "&interval=60&variables=" + variable + "&start=" +
                  str(start_date) + "%20" + str(start_time) + "&end=" + str(end_date) + "%20" + str(end_time) + "&char_type=measurement")


    print(base_url + custom_url)
    
    return base_url + custom_url



def get_requests_for_row(row, start_date, end_date, variable, start_time, end_time):
    """Helper for get_data. Gets requets for a given row, for a pre-defined start-date, end-date, pollution variant and time """

    
    url = generate_url(urllib.parse.quote(row["Location"]), row["Node ID"], variable, start_date, start_time, end_date, end_time)

    try:
        data = pd.read_csv(url)
    except:
        data = pd.DataFrame()

        #storing logs
        FAILED_REQUESTS["node_id"].append(row["Node ID"])
        FAILED_REQUESTS["location"].append(row["Location"])
        FAILED_REQUESTS["time"].append(datetime.datetime.now()) 

    return data



def get_data(data, start_date, end_date, variable, start_time, end_time):
    """Loads all the measurements from the nodes and store them into a pandas dataframe. To modify specifics go to get_requests for row"""
    all_data = data.apply(get_requests_for_row, axis=1, args=(start_date, end_date, variable, start_time,end_time))
    combined = pd.concat(all_data.values,sort=True)
    return combined

def get_all_data(sensors_df, start_date, end_date, variable, start_time, end_time):

    #get a list of the Node IDS
    node_ids = sensors_df["Node ID"].tolist()

    #get a list of the locations
    locations = sensors_df["Location"].tolist()

    data = ""


    for i in range(len(node_ids)):
        url = generate_url(urllib.parse.quote(locations[i]), node_ids[i], variable, start_date, start_time, end_date, end_time)
        response = requests.get(url)

        if response.status_code == 200:
          # Remove the header (first line) from the response content
          if i == 0:
            data += response.text
          content_lines = response.text.split('\n')
          data_content = '\n'.join(content_lines[1:])
          data += data_content
    return pd.read_csv(io.StringIO(data))

           
            

### DATA CLEANING 


def pst_to_est(time):
  """Takes in time represented as a string and returns, in the same format, the time converted into est. Returns a str,"""

  #convert it to a time date module
  if type(time) == str:
    time = datetime.datetime.strptime(time,"%Y-%m-%d %H:%M:%S")

  new_time = time.astimezone(timezone('US/Pacific'))
  return new_time

def est_to_pst(time):
  """Takes in time represented as a datetime and returns, in the same format, the time converted into pst. Assumes the time is est. Returns a str,"""


  # Convert to Pacific Timezone
  date = time.astimezone(timezone('US/Pacific'))

  # Format the date as a string and return
  return date

def pst_to_est(pst_time_str):
  # Create a timezone object for PST
  pst_timezone = timezone('US/Pacific')
    
  # Convert the input time string to a datetime object in PST
  pst_time = datetime.datetime.strptime(pst_time_str, '%Y-%m-%d %H:%M:%S')
  pst_time = pst_timezone.localize(pst_time)
    
  # Convert the PST datetime to EST
  est_timezone = timezone('US/Eastern')
  est_time = pst_time.astimezone(est_timezone)
    
  # Format the EST datetime as a string
  est_time_str = est_time.strftime('%Y-%m-%d %H:%M:%S')
    
  return est_time_str




def clean_data(data, pollutant):
  """Cleans the panda dataframe removing missing data, drops unecessary columns and tranforms data from pst to est"""

  #drop unecessary columns
  data = data.drop(columns=['epoch','datetime',"node_file_id"])

  ###TODO: change this to be using local_timestamp instead of datetime

  #for each pollutant gettin rid of missing data, renaming
  if pollutant == "co2":
    data = data.rename(columns={'co2_corrected_avg_t_drift_applied': 'co2_corrected'})
    data = data.replace({"co2_corrected": {-999.00000: np.nan}})
    data = data.dropna(subset=['local_timestamp', "co2_corrected"])
    data["co2_corrected"] = data["co2_corrected"].map(lambda x: round(x))

  elif pollutant == "co":
    data = data.replace({"co_corrected": {-999.00000: np.nan}})
    data = data.dropna(subset=['local_timestamp', "co_corrected"])


  #change time zones, make it display in actual est time
  data['local_timestamp'] = data['local_timestamp'].map(lambda x: pst_to_est(x))

  #make the datetime be a string and not include -08:00
  data['local_timestamp'] = data['local_timestamp'].map(lambda x: str(x)[0:19])

  #rename local_timestamp to datetime
  data = data.rename(columns={'local_timestamp': 'datetime'})

  return data

def convert_latitude(latitude):
    value, direction = latitude.split()
    value = float(value)
    if direction == 'S':
        value = -value
    return value

def convert_longitude(longitude):
    value, direction = longitude.split()
    value = float(value)
    if direction == 'W':
        value = -value
    return value



def convert_final():
     
    directory = './data'
    file_name = 'sensors_with_nodes.csv'
    file_path = os.path.join(directory, file_name)
    sensors_df = pd.read_csv(file_path,usecols=["Sensor ID","Node ID","Location","Latitude","Longitude","Installation Date"])



    curr_time = est_to_pst(datetime.datetime.now())

    ##subtract 1 day from current time
    start_time = curr_time - datetime.timedelta(days=1)


    #round curr_time and start_time to the nearest hour
    curr_time = curr_time.replace(minute=0, second=0, microsecond=0)
    start_time = start_time.replace(minute=0, second=0, microsecond=0)

    ## converting both of them to strings
    start_date = str(start_time)[0:10]
    start_time = str(start_time)[11:19]

    end_date = str(curr_time)[0:10]
    end_time = str(curr_time)[11:19] 

    if pollutant == "co2":
      VARIABLE = "co2_corrected_avg_t_drift_applied"
    elif pollutant == "co":
      VARIABLE = "co_corrected"
      


    data = get_data(sensors_df,start_date, end_date, VARIABLE, start_time, end_time)
    data = clean_data(data,pollutant)


    data.sort_values(by='datetime', ascending=True, inplace=True)

    #maybe add these late
    combined_data = pd.merge(data, sensors_df, left_on='node_id', right_on='Node ID', how="right", sort=False)
    combined_data.fillna(-1, inplace=True)


    combined_data = combined_data.drop(["node_id"], axis='columns')
    combined_data['Latitude'] = combined_data['Latitude'].apply(convert_latitude)
    combined_data['Longitude'] = combined_data['Longitude'].apply(convert_longitude)
   


    directory = "./public"
    print_comb = combined_data.to_json(orient='records')

    #save failed logs
    # store_failed_requests(combined_data)
    
   
  
    #save as csv 
    combined_data.to_csv(os.path.join("./data/tests", 'coords_batch_one_test.csv'), index=False)
    

    #comment this out if it works 
    combined_data.to_json(os.path.join(directory, 'coords.json'), orient='records')

    return print_comb


####### FINAL API END-POINT


# ### File is correct 
final_data = convert_final()

print(final_data,flush=True)

# print("--- %s seconds ---" % (time.time() - start_time))







