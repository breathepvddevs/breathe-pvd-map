

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

import asyncio
import aiohttp



###################

#keep track of time it starts to run
start_time = time.time()


###Receiving incoming arguments


pollutant = str(sys.argv[1])
# pollutant = "co2"
batch_num = int(sys.argv[2])
# batch_num = 3



### Global variable for failed requests
FAILED_REQUESTS = {"node_id":[], "location":[], "time":[]}




###PRE-PROCESSING READING

def generate_url(node_name, node_id, variable, start_date, start_time, end_date, end_time):
    """Given a node_id, measure, start date and end date return the raw cvs files for that node """

    base_url = "http://128.32.208.8"


    custom_url = ("/node/" + str(node_id)
                  + "/measurements_all/csv?name=" + str(node_name) + "&interval=60&variables=" + variable + "&start=" +
                  str(start_date) + "%20" + str(start_time) + "&end=" + str(end_date) + "%20" + str(end_time) + "&char_type=measurement")
    
    return base_url + custom_url

async def fetch_data(session, url,node_id):
    async with session.get(url) as response:
        if response.status == 200:
            output = await response.text()
            return output 
        else:
            return None
        

async def get_all_data_async(sensors_df, start_date, end_date, variable, start_time, end_time):
    base_url = "http://128.32.208.8"

    tasks = []
    sensors_df = sensors_df.sample(n=7, random_state=42).reset_index(drop=True)
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit_per_host=30)) as session:
        for i in range(len(sensors_df)):
            location = urllib.parse.quote(sensors_df["Location"][i])
            node_id = sensors_df["Node ID"][i]
            url = f"{base_url}/node/{node_id}/measurements_all/csv?name={location}&interval=60&variables={variable}&start={start_date}%20{start_time}&end={end_date}%20{end_time}&char_type=measurement"
            tasks.append(fetch_data(session, url,node_id))

        data_list = await asyncio.gather(*tasks)

    data = '\n'.join(data for data in data_list if data is not None)
 

    return pd.read_csv(io.StringIO(data))


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
    data = data[data["co2_corrected"] != "co2_corrected_avg_t_drift_applied"]
    data["co2_corrected"] = data["co2_corrected"].apply(lambda x: float(x))
    data["co2_corrected"] = data["co2_corrected"].apply(lambda x: round(x))
    

  elif pollutant == "co":
    data = data.replace({"co_corrected": {-999.00000: np.nan}})
    data = data[data["co_corrected"] != "co_corrected"]
    data["co_corrected"] = data["co_corrected"].apply(lambda x: float(x))
    data = data.dropna(subset=['local_timestamp', "co_corrected"])


  #change time zones, make it display in actual est time
  data['local_timestamp'] = data['local_timestamp'].map(lambda x: pst_to_est(x))

  # #make the datetime be a string and not include -08:00
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



async def convert_final(batch_num):
     
    directory = './data'
    file_name = 'sensors_with_nodes.csv'
    file_path = os.path.join(directory, file_name)
    all_sensors_df = pd.read_csv(file_path,usecols=["Sensor ID","Node ID","Location","Latitude","Longitude","Installation Date"])

    if batch_num == 1:
      sensors_df = all_sensors_df[0:7]
    elif batch_num == 2:
      sensors_df = all_sensors_df[8:15]
    elif batch_num == 3:
      sensors_df = all_sensors_df[16:23]
    elif batch_num == 0:
      sensors_df = all_sensors_df

    curr_time = est_to_pst(datetime.datetime.now())

    ##subtract 1 day from current time
    start_time = curr_time - datetime.timedelta(days=1)


    ######## FOR TESTING AND DEMO ONLY #############
    # # # make starttime be September 1st 2023, at 2 pm 
    # start_time = datetime.datetime(2023,9,1,14,0,0)

    # # # #make end time septmeber 3rd 2023, at 2 pm
    # curr_time = datetime.datetime(2023,9,3,14,0,0)
    ################################################


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
      


    data = await get_all_data_async(sensors_df,start_date, end_date, VARIABLE, start_time, end_time)
    data = clean_data(data,pollutant)

  
    # print("this is the actual data")
    # data = get_data(sensors_df,start_date, end_date, VARIABLE, start_time, end_time)
    # data = clean_data(data,pollutant)

    data.sort_values(by='datetime', ascending=True, inplace=True)

    #maybe add these late
    sensors_df['Node ID'] = sensors_df["Node ID"].astype(str) 
    combined_data = pd.merge(data, sensors_df, left_on='node_id', right_on='Node ID', how="right", sort=False)
    combined_data.fillna(-1, inplace=True)


    combined_data = combined_data.drop(["node_id"], axis='columns')
    combined_data['Latitude'] = combined_data['Latitude'].apply(convert_latitude)
    combined_data['Longitude'] = combined_data['Longitude'].apply(convert_longitude)

  
    #Checking uniqueness
    # print(combined_data[combined_data["co_corrected"] != -1]["Node ID"].unique())

    directory = "./public"
    print_comb = combined_data.to_json(orient='records')

    #save failed logs
    # store_failed_requests(combined_data)
    
    #save as csv 
    combined_data.to_csv(os.path.join("./data/tests", 'coords_all.csv'), index=False)
    

    # #comment this out if it works 
    # combined_data.to_json(os.path.join(directory, 'coords.json'), orient='records')

    return print_comb


####### FINAL API END-POINT


# ### File is correct global SUCCESS
loop = asyncio.get_event_loop()
final_data = loop.run_until_complete(convert_final(batch_num))
loop.close()



print(final_data, flush=True)

# print(len(final_data))

# print("--- %s seconds ---" % (time.time() - start_time))

