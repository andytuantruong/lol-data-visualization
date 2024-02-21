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

driver.close()