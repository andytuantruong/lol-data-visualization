import pandas as pd

data = pd.read_csv('player_stats.csv')

extracted_data = data[['Player', 'GP', 'K']]

#accounting for two maps played
extracted_data['Avg'] = (extracted_data['K'] / extracted_data['GP']) * 2

print(extracted_data)