import pandas as pd

data = pd.read_csv('player_stats.csv')

extracted_data = data[['Player', 'GP', 'K']].copy()

#accounting for two maps played
extracted_data['Avg'] = (extracted_data['K'] / extracted_data['GP']) * 2

extracted_data_sorted = extracted_data.sort_values(by='Avg', ascending=False)

print(extracted_data_sorted)