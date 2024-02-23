import requests
import time
import pandas as pd

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Firefox()

url = "https://gol.gg/esports/home/"
player_to_search = "369"

driver.get(url)
time.sleep(1)

WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CLASS_NAME, "search")))
search_input = driver.find_element(By.XPATH,"/html/body/div/main/div[2]/div/div[1]/div/span[2]/div/div[1]/input")

search_input.send_keys(player_to_search)

search_input.send_keys(Keys.ENTER)

time.sleep(3)

print("Current URL after search:", driver.current_url)

#pull up entire match history for player
all_matches = driver.find_element(By.XPATH, "/html/body/div/main/div[2]/div/div[1]/div/form/div[1]/div[1]/table/tbody/tr/td[2]/div/span[1]/a")
all_matches.click()

match_list = driver.find_element(By.XPATH, "/html/body/div/main/div[2]/div/div[2]/div/nav/div/ul/li[2]/a")
match_list.click()
time.sleep(3)

#scraping the match history table 
tbody_element = driver.find_element(By.XPATH, "/html/body/div/main/div[2]/div/div[3]/div/div/div/table/tbody")
tr_elements = tbody_element.find_elements(By.XPATH, ".//tr")

data = []

for index in range(len(tr_elements)):
   result = driver.find_element(By.XPATH, f"/html/body/div/main/div[2]/div/div[3]/div/div/div/table/tbody/tr[{index+1}]/td[2]").text
   kda = driver.find_element(By.XPATH, f"/html/body/div/main/div[2]/div/div[3]/div/div/div/table/tbody/tr[{index+1}]/td[3]").text
   duration = driver.find_element(By.XPATH, f"/html/body/div/main/div[2]/div/div[3]/div/div/div/table/tbody/tr[{index+1}]/td[5]").text
   date = driver.find_element(By.XPATH, f"/html/body/div/main/div[2]/div/div[3]/div/div/div/table/tbody/tr[{index+1}]/td[6]").text
   data.append((result, kda, duration, date))

df = pd.DataFrame(data, columns=["Result", "KDA", "Duration", "Date"])

csv_file_path = "test.csv"

df.to_csv(csv_file_path, index=False)

driver.close()