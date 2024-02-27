import csv
import pandas as pd

def read_txt_file(txt_file):
    with open(txt_file, 'r') as file:
        lines = [line.strip() for line in file if line.strip()]
    return lines

def write_csv_file(output_file, headers, rows):
    with open(output_file, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)

# splits data into rows given the headers 
def create_rows(data, headers):
    rows = []
    for i in range(0, len(data), len(headers)):
        row_data = data[i:i+len(headers)]
        rows.append(row_data)
    return rows

def remove_column(csv_file, column_name):
    df = pd.read_csv(csv_file)
    df.drop(columns=[column_name], inplace=True)
    df.to_csv(csv_file, index=False)

def clean_txt_to_csv(input_txt_file, output_csv_file, headers):
    lines = read_txt_file(input_txt_file)
    rows = create_rows(lines, headers)
    write_csv_file(output_csv_file, headers, rows)
    print("Conversion complete, output.csv saved and stored!", output_csv_file)

input_txt_file = 'input_pp.txt'
output_csv_file = 'output.csv'
headers = ['Name', 'Name_Duplicate', 'Team', 'VS', 'prop', 'map_count', 'less', 'more']

clean_txt_to_csv(input_txt_file, output_csv_file, headers)

duplicate_remove_csv = 'output.csv'
remove_column(duplicate_remove_csv, 'Name_Duplicate')
remove_column(duplicate_remove_csv, 'Team')
remove_column(duplicate_remove_csv, 'VS')
remove_column(duplicate_remove_csv, 'less')
remove_column(duplicate_remove_csv, 'more')
