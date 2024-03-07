import pandas as pd

data = pd.read_csv('player_stats.csv')

extracted_data = data[['Player', 'GP', 'K']]
extracted_data['Avg'] = extracted_data['K'] / extracted_data['GP']

print(extracted_data)